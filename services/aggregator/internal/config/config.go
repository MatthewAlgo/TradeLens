package config

import (
	"os"
	"strconv"
)

type Config struct {
	RedpandaBrokers string
	TimescaleDSN    string
	Intervals       string
	TickGrouping    int
}

func Load() *Config {
	tg, _ := strconv.Atoi(getEnv("TICK_GROUPING", "1000"))
	return &Config{
		RedpandaBrokers: getEnv("REDPANDA_BROKERS", "localhost:19092"),
		TimescaleDSN:    getEnv("TIMESCALE_DSN", "postgres://tradelens:tradelens_secret@localhost:5432/market_data?sslmode=disable"),
		Intervals:       getEnv("INTERVALS", "1m,5m,15m,1h"),
		TickGrouping:    tg,
	}
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
