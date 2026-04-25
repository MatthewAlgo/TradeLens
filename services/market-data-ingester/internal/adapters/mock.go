package adapters

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/MatthewAlgo/TradeLens/services/market-data-ingester/internal/normalizer"
	"github.com/gorilla/websocket"
)

// MockAdapter connects to the local mock exchange WebSocket server.
type MockAdapter struct {
	url string
}

func NewMockAdapter(url string) *MockAdapter {
	return &MockAdapter{url: url}
}

func (m *MockAdapter) Connect(ctx context.Context, tickCh chan<- []byte) error {
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		slog.Info("Connecting to Mock Exchange", "url", m.url)
		conn, _, err := websocket.DefaultDialer.Dial(m.url, nil)
		if err != nil {
			slog.Error("Mock Exchange connection failed, retrying...", "error", err)
			time.Sleep(2 * time.Second)
			continue
		}

		slog.Info("Connected to Mock Exchange")
		err = m.readLoop(ctx, conn, tickCh)
		conn.Close()

		if ctx.Err() != nil {
			return ctx.Err()
		}

		slog.Warn("Mock Exchange connection lost, reconnecting...", "error", err)
		time.Sleep(1 * time.Second)
	}
}

func (m *MockAdapter) readLoop(ctx context.Context, conn *websocket.Conn, tickCh chan<- []byte) error {
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		_, message, err := conn.ReadMessage()
		if err != nil {
			return fmt.Errorf("read error: %w", err)
		}

		// Parse mock exchange message (same format as Binance)
		var trade BinanceTrade
		if err := json.Unmarshal(message, &trade); err != nil {
			continue
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
			"mock",
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
