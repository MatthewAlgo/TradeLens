package engine

import (
	"encoding/json"
	"testing"
	"time"
)

func TestTruncateToInterval(t *testing.T) {
	ts := time.Date(2025, 1, 1, 12, 34, 56, 0, time.UTC)

	if got := truncateToInterval(ts, "1m"); got.Minute() != 34 || got.Second() != 0 {
		t.Fatalf("unexpected 1m truncate result: %v", got)
	}

	if got := truncateToInterval(ts, "5m"); got.Minute() != 30 || got.Second() != 0 {
		t.Fatalf("unexpected 5m truncate result: %v", got)
	}
}

func TestProcessTickUpdatesCandleState(t *testing.T) {
	e := New([]string{"1m"}, 1000, nil, nil, nil)
	tick := NormalizedTick{
		TimestampMs: 1735732800000,
		Symbol:      "BTCUSDT",
		Price:       100.0,
		Quantity:    2.5,
		TradeID:     1,
		Exchange:    "mock",
	}

	b, err := json.Marshal(tick)
	if err != nil {
		t.Fatalf("marshal failed: %v", err)
	}

	e.ProcessTick(b)

	se, ok := e.symbols["BTCUSDT"]
	if !ok {
		t.Fatalf("expected SymbolEngine for BTCUSDT")
	}

	c, ok := se.candles["1m"]
	if !ok {
		t.Fatalf("expected candle for 1m interval")
	}

	if c.Open != 100.0 || c.Close != 100.0 {
		t.Fatalf("unexpected open/close: %+v", c)
	}
	if c.Volume != 2.5 {
		t.Fatalf("expected volume 2.5, got %f", c.Volume)
	}
}
