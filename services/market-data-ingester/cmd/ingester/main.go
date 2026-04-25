// Package main — TradeLens Market Data Ingester
// Connects to exchanges via WebSocket, normalizes data, and publishes to Redpanda.
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/MatthewAlgo/TradeLens/services/market-data-ingester/internal/adapters"
	"github.com/MatthewAlgo/TradeLens/services/market-data-ingester/internal/config"
	"github.com/MatthewAlgo/TradeLens/services/market-data-ingester/internal/producer"
)

func main() {
	// Structured logging
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	slog.Info("Starting TradeLens Market Data Ingester")

	// Load configuration
	cfg := config.Load()

	// Create context with cancellation
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initialize Redpanda producer
	prod, err := producer.New(cfg.RedpandaBrokers, "raw_ticks")
	if err != nil {
		slog.Error("Failed to create producer", "error", err)
		os.Exit(1)
	}
	defer prod.Close()

	slog.Info("Redpanda producer initialized", "brokers", cfg.RedpandaBrokers)

	// Create exchange adapter based on mode
	var adapter adapters.ExchangeAdapter
	symbols := strings.Split(cfg.Symbols, ",")

	switch cfg.ExchangeMode {
	case "binance":
		adapter = adapters.NewBinanceAdapter(cfg.BinanceWSURL, symbols)
		slog.Info("Using Binance adapter", "url", cfg.BinanceWSURL, "symbols", symbols)
	default:
		adapter = adapters.NewMockAdapter(cfg.MockExchangeURL)
		slog.Info("Using Mock Exchange adapter", "url", cfg.MockExchangeURL)
	}

	// Channel for normalized ticks
	tickCh := make(chan []byte, 10000)

	// Start adapter in goroutine
	go func() {
		if err := adapter.Connect(ctx, tickCh); err != nil {
			slog.Error("Adapter connection failed", "error", err)
			cancel()
		}
	}()

	// Start producer pipeline: read from channel, publish to Redpanda
	go func() {
		count := 0
		for {
			select {
			case <-ctx.Done():
				return
			case data := <-tickCh:
				if err := prod.Publish(ctx, data); err != nil {
					slog.Error("Failed to publish", "error", err)
				}
				count++
				if count%5000 == 0 {
					slog.Info("Published ticks", "count", count)
				}
			}
		}
	}()

	// Wait for shutdown signal
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	sig := <-sigCh
	slog.Info("Shutdown signal received", "signal", sig)
	cancel()
	slog.Info("Market Data Ingester stopped")
}
