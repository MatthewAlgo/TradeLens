package config

import "testing"

func TestLoadDefaults(t *testing.T) {
	t.Setenv("EXCHANGE_MODE", "")
	t.Setenv("MOCK_EXCHANGE_URL", "")
	t.Setenv("BINANCE_WS_URL", "")
	t.Setenv("REDPANDA_BROKERS", "")
	t.Setenv("SYMBOLS", "")

	cfg := Load()

	if cfg.ExchangeMode != "mock" {
		t.Fatalf("expected default exchange mode mock, got %s", cfg.ExchangeMode)
	}
	if cfg.RedpandaBrokers != "localhost:19092" {
		t.Fatalf("expected default brokers localhost:19092, got %s", cfg.RedpandaBrokers)
	}
}

func TestLoadOverrides(t *testing.T) {
	t.Setenv("EXCHANGE_MODE", "binance")
	t.Setenv("REDPANDA_BROKERS", "redpanda:9092")
	t.Setenv("SYMBOLS", "BTCUSDT")

	cfg := Load()

	if cfg.ExchangeMode != "binance" {
		t.Fatalf("expected binance mode, got %s", cfg.ExchangeMode)
	}
	if cfg.RedpandaBrokers != "redpanda:9092" {
		t.Fatalf("expected redpanda:9092, got %s", cfg.RedpandaBrokers)
	}
	if cfg.Symbols != "BTCUSDT" {
		t.Fatalf("expected BTCUSDT symbols, got %s", cfg.Symbols)
	}
}
