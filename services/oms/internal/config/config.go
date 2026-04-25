package config

import "os"

type Config struct {
	Port            string
	RedpandaBrokers string
	PostgresDSN     string
	RedisAddr       string
	InitialBalance  float64
	CommissionRate  float64
	SlippageBPS     float64
}

func Load() *Config {
	return &Config{
		Port:            getEnv("PORT", "4001"),
		RedpandaBrokers: getEnv("REDPANDA_BROKERS", "localhost:19092"),
		PostgresDSN:     getEnv("POSTGRES_DSN", "postgres://tradelens:tradelens_secret@localhost:5433/tradelens?sslmode=disable"),
		RedisAddr:       getEnv("REDIS_ADDR", "localhost:6379"),
		InitialBalance:  100000.0,
		CommissionRate:  0.001,   // 0.1% commission (Binance standard)
		SlippageBPS:     5.0,     // 5 basis points slippage simulation
	}
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
