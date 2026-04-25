// Package config provides configuration loading for the ingester service.
package config

import "os"

// Config holds all ingester configuration.
type Config struct {
	ExchangeMode    string // "mock" or "binance"
	MockExchangeURL string
	BinanceWSURL    string
	RedpandaBrokers string
	Symbols         string
}

// Load reads configuration from environment variables with sensible defaults.
func Load() *Config {
	return &Config{
		ExchangeMode:    getEnv("EXCHANGE_MODE", "mock"),
		MockExchangeURL: getEnv("MOCK_EXCHANGE_URL", "ws://localhost:8765"),
		BinanceWSURL:    getEnv("BINANCE_WS_URL", "wss://stream.binance.com:9443/ws"),
		RedpandaBrokers: getEnv("REDPANDA_BROKERS", "localhost:19092"),
		Symbols:         getEnv("SYMBOLS", "BTCUSDT,ETHUSDT"),
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
