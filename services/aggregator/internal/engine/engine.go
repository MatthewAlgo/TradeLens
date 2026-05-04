// Package engine implements the OHLCV and Footprint aggregation logic.
package engine

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"sort"
	"sync"
	"time"

	"github.com/MatthewAlgo/TradeLens/services/aggregator/internal/producer"
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

// --- Kafka message types (JSON serializable for the api-gateway WS bridge) ---

// CandleMessage is published to the "candles" Kafka topic.
type CandleMessage struct {
	Time       string  `json:"time"`
	Symbol     string  `json:"symbol"`
	Interval   string  `json:"interval"`
	Open       float64 `json:"open"`
	High       float64 `json:"high"`
	Low        float64 `json:"low"`
	Close      float64 `json:"close"`
	Volume     float64 `json:"volume"`
	TradeCount int     `json:"trade_count"`
}

// FootprintLevelMessage is a single price level in a footprint candle.
type FootprintLevelMessage struct {
	PriceLevel  float64 `json:"price_level"`
	BidVolume   float64 `json:"bid_volume"`
	AskVolume   float64 `json:"ask_volume"`
	Delta       float64 `json:"delta"`
	TotalVolume float64 `json:"total_volume"`
}

// FootprintCandleMessage is published to the "footprints" Kafka topic.
type FootprintCandleMessage struct {
	Time         string                  `json:"time"`
	Symbol       string                  `json:"symbol"`
	Interval     string                  `json:"interval"`
	TickGrouping int                     `json:"tick_grouping"`
	Levels       []FootprintLevelMessage `json:"levels"`
	DeltaTotal   float64                 `json:"delta_total"`
	TotalVolume  float64                 `json:"total_volume"`
}

// SymbolEngine manages aggregation state for a single symbol.
type SymbolEngine struct {
	mu         sync.Mutex
	symbol     string
	candles    map[string]*Candle          // key: "1m", "5m"
	footprints map[string]*FootprintCandle // key: "1m", "5m"
	engine     *Engine                     // reference back to main engine for shared config/writers
}

// Engine manages the collection of per-symbol engines.
type Engine struct {
	mu                sync.RWMutex
	intervals         []string
	tickGrouping      int
	writer            *writer.Writer
	candleProducer    *producer.Producer // publishes to "candles" Kafka topic
	footprintProducer *producer.Producer // publishes to "footprints" Kafka topic
	symbols           map[string]*SymbolEngine
	tickCount         int64
}

// New creates an aggregation engine.
// candleProd and footprintProd may be nil (Kafka publishing disabled).
func New(intervals []string, tickGrouping int, w *writer.Writer, candleProd *producer.Producer, footprintProd *producer.Producer) *Engine {
	return &Engine{
		intervals:         intervals,
		tickGrouping:      tickGrouping,
		writer:            w,
		candleProducer:    candleProd,
		footprintProducer: footprintProd,
		symbols:           make(map[string]*SymbolEngine),
	}
}

// getOrCreateSymbolEngine returns the SymbolEngine for a symbol, creating it if necessary.
func (e *Engine) getOrCreateSymbolEngine(symbol string) *SymbolEngine {
	e.mu.RLock()
	se, exists := e.symbols[symbol]
	e.mu.RUnlock()

	if exists {
		return se
	}

	e.mu.Lock()
	defer e.mu.Unlock()
	// Double-check after acquiring write lock
	if se, exists = e.symbols[symbol]; exists {
		return se
	}

	se = &SymbolEngine{
		symbol:     symbol,
		candles:    make(map[string]*Candle),
		footprints: make(map[string]*FootprintCandle),
		engine:     e,
	}
	e.symbols[symbol] = se
	return se
}

// ProcessTick routes a normalized tick to the correct per-symbol engine.
func (e *Engine) ProcessTick(data []byte) {
	var tick NormalizedTick
	if err := json.Unmarshal(data, &tick); err != nil {
		slog.Error("Failed to unmarshal tick", "error", err)
		return
	}

	// Lock-free routing (after initial creation)
	se := e.getOrCreateSymbolEngine(tick.Symbol)
	se.processTick(tick)

	// Atomic counter would be better, but this is just for logging
	e.mu.Lock()
	e.tickCount++
	if e.tickCount%10000 == 0 {
		slog.Info("Aggregator processed ticks", "count", e.tickCount)
	}
	e.mu.Unlock()
}

// processTick handles a single tick under the symbol-specific lock.
func (se *SymbolEngine) processTick(tick NormalizedTick) {
	se.mu.Lock()
	defer se.mu.Unlock()

	tickTime := time.UnixMilli(tick.TimestampMs)

	for _, interval := range se.engine.intervals {
		se.updateCandle(tick, tickTime, interval)
		se.updateFootprint(tick, tickTime, interval)
	}
}

func (se *SymbolEngine) updateCandle(tick NormalizedTick, tickTime time.Time, interval string) {
	candleOpen := truncateToInterval(tickTime, interval)
	candle, exists := se.candles[interval]

	// Check if we need to close the current candle and start a new one
	if exists && !candle.OpenTime.Equal(candleOpen) {
		// Close the old candle
		se.engine.flushCandle(candle)
		exists = false
	}

	if !exists {
		candle = &Candle{
			Symbol:     tick.Symbol,
			Interval:   interval,
			OpenTime:   candleOpen,
			Open:       tick.Price,
			High:       tick.Price,
			Low:        tick.Price,
			Close:      tick.Price,
			Volume:     tick.Quantity,
			TradeCount: 1,
		}
		se.candles[interval] = candle
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

func (se *SymbolEngine) updateFootprint(tick NormalizedTick, tickTime time.Time, interval string) {
	candleOpen := truncateToInterval(tickTime, interval)
	fp, exists := se.footprints[interval]

	if exists && !fp.OpenTime.Equal(candleOpen) {
		se.engine.flushFootprint(fp)
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
			TickGrouping: se.engine.tickGrouping,
			Levels:       make(map[float64]*FootprintLevel),
		}
		se.footprints[interval] = fp
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
	groupingPrice := float64(se.engine.tickGrouping) / 100.0
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
	// 1. Write to TimescaleDB
	if e.writer != nil {
		if err := e.writer.WriteCandle(c.OpenTime, c.Symbol, c.Interval,
			c.Open, c.High, c.Low, c.Close, c.Volume, c.TradeCount); err != nil {
			slog.Error("Failed to write candle", "error", err, "symbol", c.Symbol, "interval", c.Interval)
		}
	}

	// 2. Publish to Kafka so the api-gateway WS bridge can relay to clients
	if e.candleProducer != nil {
		msg := CandleMessage{
			Time:       c.OpenTime.Format(time.RFC3339),
			Symbol:     c.Symbol,
			Interval:   c.Interval,
			Open:       c.Open,
			High:       c.High,
			Low:        c.Low,
			Close:      c.Close,
			Volume:     c.Volume,
			TradeCount: c.TradeCount,
		}
		data, err := json.Marshal(msg)
		if err != nil {
			slog.Error("Failed to marshal candle for Kafka", "error", err)
		} else {
			key := fmt.Sprintf("%s:%s", c.Symbol, c.Interval)
			if pubErr := e.candleProducer.PublishKeyed(context.Background(), key, data); pubErr != nil {
				slog.Error("Failed to publish candle to Kafka", "error", pubErr, "key", key)
			}
		}
	}
}

func (e *Engine) flushFootprint(fp *FootprintCandle) {
	// 1. Write individual levels to TimescaleDB
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

	// 2. Publish full footprint candle to Kafka as a single message
	if e.footprintProducer != nil {
		levels := make([]FootprintLevelMessage, 0, len(fp.Levels))
		var deltaTotal, totalVolume float64
		for _, level := range fp.Levels {
			d := level.AskVolume - level.BidVolume
			t := level.AskVolume + level.BidVolume
			deltaTotal += d
			totalVolume += t
			levels = append(levels, FootprintLevelMessage{
				PriceLevel:  level.PriceLevel,
				BidVolume:   level.BidVolume,
				AskVolume:   level.AskVolume,
				Delta:       d,
				TotalVolume: t,
			})
		}
		// Sort levels by price for consistent ordering
		sort.Slice(levels, func(i, j int) bool {
			return levels[i].PriceLevel < levels[j].PriceLevel
		})

		msg := FootprintCandleMessage{
			Time:         fp.OpenTime.Format(time.RFC3339),
			Symbol:       fp.Symbol,
			Interval:     fp.Interval,
			TickGrouping: fp.TickGrouping,
			Levels:       levels,
			DeltaTotal:   deltaTotal,
			TotalVolume:  totalVolume,
		}
		data, err := json.Marshal(msg)
		if err != nil {
			slog.Error("Failed to marshal footprint for Kafka", "error", err)
		} else {
			key := fmt.Sprintf("%s:%s", fp.Symbol, fp.Interval)
			if pubErr := e.footprintProducer.PublishKeyed(context.Background(), key, data); pubErr != nil {
				slog.Error("Failed to publish footprint to Kafka", "error", pubErr, "key", key)
			}
		}
	}
}

// FlushAll writes all in-progress candles and footprints on shutdown.
func (e *Engine) FlushAll() {
	e.mu.RLock()
	defer e.mu.RUnlock()

	for _, se := range e.symbols {
		se.mu.Lock()
		for _, c := range se.candles {
			e.flushCandle(c)
		}
		for _, fp := range se.footprints {
			e.flushFootprint(fp)
		}
		se.mu.Unlock()
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
