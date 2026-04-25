package adapters

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/MatthewAlgo/TradeLens/services/market-data-ingester/internal/normalizer"
	"github.com/gorilla/websocket"
)

// BinanceAdapter connects to the Binance WebSocket API for live trade streams.
type BinanceAdapter struct {
	baseURL string
	symbols []string
}

// BinanceTrade represents a raw trade event from Binance.
type BinanceTrade struct {
	EventType    string `json:"e"`
	EventTime    int64  `json:"E"`
	Symbol       string `json:"s"`
	TradeID      int64  `json:"t"`
	Price        string `json:"p"`
	Quantity     string `json:"q"`
	TradeTime    int64  `json:"T"`
	IsBuyerMaker bool   `json:"m"`
}

// NormalizedTick is the internal tick format published to Redpanda.
type NormalizedTick = normalizer.Tick

func NewBinanceAdapter(baseURL string, symbols []string) *BinanceAdapter {
	return &BinanceAdapter{
		baseURL: baseURL,
		symbols: symbols,
	}
}

func (b *BinanceAdapter) Connect(ctx context.Context, tickCh chan<- []byte) error {
	// Build combined stream URL
	streams := make([]string, len(b.symbols))
	for i, s := range b.symbols {
		streams[i] = strings.ToLower(s) + "@trade"
	}
	url := fmt.Sprintf("%s/%s", b.baseURL, strings.Join(streams, "/"))

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		slog.Info("Connecting to Binance", "url", url)
		conn, _, err := websocket.DefaultDialer.Dial(url, nil)
		if err != nil {
			slog.Error("Binance connection failed", "error", err)
			time.Sleep(5 * time.Second)
			continue
		}

		slog.Info("Connected to Binance")
		err = b.readLoop(ctx, conn, tickCh)
		conn.Close()

		if ctx.Err() != nil {
			return ctx.Err()
		}

		slog.Warn("Binance connection lost, reconnecting...", "error", err)
		time.Sleep(2 * time.Second)
	}
}

func (b *BinanceAdapter) readLoop(ctx context.Context, conn *websocket.Conn, tickCh chan<- []byte) error {
	// Set pong handler for keep-alive
	conn.SetPongHandler(func(string) error {
		return conn.SetReadDeadline(time.Now().Add(30 * time.Second))
	})

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		conn.SetReadDeadline(time.Now().Add(30 * time.Second))
		_, message, err := conn.ReadMessage()
		if err != nil {
			return fmt.Errorf("read error: %w", err)
		}

		// Parse Binance trade
		var trade BinanceTrade
		if err := json.Unmarshal(message, &trade); err != nil {
			continue // Skip non-trade messages
		}

		if trade.EventType != "trade" {
			continue
		}

		normalized := normalizer.BuildTick(
			trade.TradeTime,
			trade.Symbol,
			trade.Price,
			trade.Quantity,
			trade.IsBuyerMaker,
			trade.TradeID,
			"binance",
		)

		data, err := json.Marshal(normalized)
		if err != nil {
			continue
		}

		select {
		case tickCh <- data:
		default:
			slog.Warn("Tick channel full, dropping tick")
		}
	}
}
