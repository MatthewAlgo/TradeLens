// Package main — TradeLens Aggregator Engine
// Consumes raw ticks from Redpanda, computes OHLCV candles and Footprint
// volume-at-price data, writes to TimescaleDB and publishes updates.
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/MatthewAlgo/TradeLens/services/aggregator/internal/config"
	"github.com/MatthewAlgo/TradeLens/services/aggregator/internal/consumer"
	"github.com/MatthewAlgo/TradeLens/services/aggregator/internal/engine"
	"github.com/MatthewAlgo/TradeLens/services/aggregator/internal/producer"
	"github.com/MatthewAlgo/TradeLens/services/aggregator/internal/writer"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)
	slog.Info("Starting TradeLens Aggregator Engine")

	cfg := config.Load()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initialize TimescaleDB writer
	db, err := writer.New(cfg.TimescaleDSN)
	if err != nil {
		slog.Error("Failed to connect to TimescaleDB", "error", err)
		os.Exit(1)
	}
	defer db.Close()
	slog.Info("TimescaleDB writer initialized")

	// Initialize aggregation engine with Kafka producers for downstream publishing
	intervals := strings.Split(cfg.Intervals, ",")

	candleProd, err := producer.New(cfg.RedpandaBrokers, "candles")
	if err != nil {
		slog.Error("Failed to create candle producer", "error", err)
		os.Exit(1)
	}
	defer candleProd.Close()

	footprintProd, err := producer.New(cfg.RedpandaBrokers, "footprints")
	if err != nil {
		slog.Error("Failed to create footprint producer", "error", err)
		os.Exit(1)
	}
	defer footprintProd.Close()

	agg := engine.New(intervals, cfg.TickGrouping, db, candleProd, footprintProd)
	slog.Info("Aggregation engine initialized", "intervals", intervals, "tickGrouping", cfg.TickGrouping)

	// Initialize Redpanda consumer
	cons, err := consumer.New(cfg.RedpandaBrokers, "raw_ticks", "aggregator-group")
	if err != nil {
		slog.Error("Failed to create consumer", "error", err)
		os.Exit(1)
	}
	defer cons.Close()
	slog.Info("Redpanda consumer initialized")

	// Start consuming and aggregating
	go cons.Consume(ctx, func(data []byte) {
		agg.ProcessTick(data)
	})

	// Graceful shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh
	slog.Info("Shutdown signal received")
	cancel()
	agg.FlushAll()
	slog.Info("Aggregator Engine stopped")
}
