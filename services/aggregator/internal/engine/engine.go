// Package engine implements the OHLCV and Footprint aggregation logic.
package engine

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"sync"
	"time"

	"github.com/MatthewAlgo/TradeLens/services/aggregator/internal/writer"
)

// NormalizedTick mirrors the format from the ingester.
type NormalizedTick struct {
	TimestampMs  int64   `json:"timestamp_ms"`
	Symbol       string  `json:"symbol"`
	Price        float64 `json:"price"`
	Quantity     float64 `json:"quantity"`
	IsBuyerMaker bool    `json:"is_buyer_maker"`
	TradeID      int64   `json:"trade_id"`
	Exchange     string  `json:"exchange"`
}

// Candle represents an in-progress OHLCV bar.
type Candle struct {
	Symbol     string
	Interval   string
	OpenTime   time.Time
	Open       float64
	High       float64
	Low        float64
	Close      float64
	Volume     float64
	TradeCount int
}

// FootprintLevel tracks bid/ask volume at a specific price level.
type FootprintLevel struct {
	PriceLevel float64
	BidVolume  float64 // Aggressive sells (is_buyer_maker = true)
	AskVolume  float64 // Aggressive buys (is_buyer_maker = false)
}

// FootprintCandle holds all footprint levels for a candle period.
type FootprintCandle struct {
	Symbol       string
	Interval     string
	OpenTime     time.Time
	Open         float64
	High         float64
	Low          float64
	Close        float64
	TickGrouping int
	Levels       map[float64]*FootprintLevel
}

// Engine manages aggregation state for all symbols and intervals.
type Engine struct {
	mu           sync.Mutex
	intervals    []string
	tickGrouping int
	writer       *writer.Writer
	candles      map[string]*Candle          // key: "BTCUSDT:1m"
	footprints   map[string]*FootprintCandle // key: "BTCUSDT:1m"
	tickCount    int64
}

func New(intervals []string, tickGrouping int, w *writer.Writer) *Engine {
	return &Engine{
		intervals:    intervals,
		tickGrouping: tickGrouping,
		writer:       w,
		candles:      make(map[string]*Candle),
		footprints:   make(map[string]*FootprintCandle),
	}
}

// ProcessTick handles a single normalized tick.
func (e *Engine) ProcessTick(data []byte) {
	var tick NormalizedTick
	if err := json.Unmarshal(data, &tick); err != nil {
		slog.Error("Failed to unmarshal tick", "error", err)
		return
	}

	e.mu.Lock()
	defer e.mu.Unlock()

	e.tickCount++
	tickTime := time.UnixMilli(tick.TimestampMs)

	for _, interval := range e.intervals {
		e.updateCandle(tick, tickTime, interval)
		e.updateFootprint(tick, tickTime, interval)
	}

	if e.tickCount%10000 == 0 {
		slog.Info("Aggregator processed ticks", "count", e.tickCount)
	}
}

func (e *Engine) updateCandle(tick NormalizedTick, tickTime time.Time, interval string) {
	key := fmt.Sprintf("%s:%s", tick.Symbol, interval)
	candleOpen := truncateToInterval(tickTime, interval)

	candle, exists := e.candles[key]

	// Check if we need to close the current candle and start a new one
	if exists && !candle.OpenTime.Equal(candleOpen) {
		// Close the old candle
		e.flushCandle(candle)
		exists = false
	}

	if !exists {
		candle = &Candle{
			Symbol:   tick.Symbol,
			Interval: interval,
			OpenTime: candleOpen,
			Open:     tick.Price,
			High:     tick.Price,
			Low:      tick.Price,
			Close:    tick.Price,
			Volume:   tick.Quantity,
			TradeCount: 1,
		}
		e.candles[key] = candle
		return
	}

	// Update existing candle
	if tick.Price > candle.High {
		candle.High = tick.Price
	}
	if tick.Price < candle.Low {
		candle.Low = tick.Price
	}
	candle.Close = tick.Price
	candle.Volume += tick.Quantity
	candle.TradeCount++
}

func (e *Engine) updateFootprint(tick NormalizedTick, tickTime time.Time, interval string) {
	key := fmt.Sprintf("%s:%s", tick.Symbol, interval)
	candleOpen := truncateToInterval(tickTime, interval)

	fp, exists := e.footprints[key]

	if exists && !fp.OpenTime.Equal(candleOpen) {
		e.flushFootprint(fp)
		exists = false
	}

	if !exists {
		fp = &FootprintCandle{
			Symbol:       tick.Symbol,
			Interval:     interval,
			OpenTime:     candleOpen,
			Open:         tick.Price,
			High:         tick.Price,
			Low:          tick.Price,
			Close:        tick.Price,
			TickGrouping: e.tickGrouping,
			Levels:       make(map[float64]*FootprintLevel),
		}
		e.footprints[key] = fp
	}

	// Update OHLC
	if tick.Price > fp.High {
		fp.High = tick.Price
	}
	if tick.Price < fp.Low {
		fp.Low = tick.Price
	}
	fp.Close = tick.Price

	// Group price to tick_grouping level
	// e.g., if tickGrouping=1000 (cents), group to $10 blocks for BTC
	groupingPrice := float64(e.tickGrouping) / 100.0
	priceLevel := math.Floor(tick.Price/groupingPrice) * groupingPrice

	level, ok := fp.Levels[priceLevel]
	if !ok {
		level = &FootprintLevel{PriceLevel: priceLevel}
		fp.Levels[priceLevel] = level
	}

	if tick.IsBuyerMaker {
		level.BidVolume += tick.Quantity // Aggressive sell
	} else {
		level.AskVolume += tick.Quantity // Aggressive buy
	}
}

func (e *Engine) flushCandle(c *Candle) {
	if e.writer != nil {
		if err := e.writer.WriteCandle(c.OpenTime, c.Symbol, c.Interval,
			c.Open, c.High, c.Low, c.Close, c.Volume, c.TradeCount); err != nil {
			slog.Error("Failed to write candle", "error", err, "symbol", c.Symbol, "interval", c.Interval)
		}
	}
}

func (e *Engine) flushFootprint(fp *FootprintCandle) {
	if e.writer != nil {
		for _, level := range fp.Levels {
			delta := level.AskVolume - level.BidVolume
			total := level.AskVolume + level.BidVolume
			if err := e.writer.WriteFootprint(fp.OpenTime, fp.Symbol, fp.Interval,
				level.PriceLevel, fp.TickGrouping, level.BidVolume, level.AskVolume,
				delta, total); err != nil {
				slog.Error("Failed to write footprint", "error", err)
			}
		}
	}
}

// FlushAll writes all in-progress candles and footprints on shutdown.
func (e *Engine) FlushAll() {
	e.mu.Lock()
	defer e.mu.Unlock()

	for _, c := range e.candles {
		e.flushCandle(c)
	}
	for _, fp := range e.footprints {
		e.flushFootprint(fp)
	}
	slog.Info("Flushed all in-progress aggregations")
}

// truncateToInterval returns the start time of the interval containing t.
func truncateToInterval(t time.Time, interval string) time.Time {
	switch interval {
	case "1m":
		return t.Truncate(time.Minute)
	case "5m":
		return t.Truncate(5 * time.Minute)
	case "15m":
		return t.Truncate(15 * time.Minute)
	case "1h":
		return t.Truncate(time.Hour)
	case "4h":
		return t.Truncate(4 * time.Hour)
	case "1d":
		return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
	default:
		return t.Truncate(time.Minute)
	}
}
