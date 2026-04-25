// Package main — TradeLens Order Management System
// Handles paper trading, order lifecycle, and portfolio management.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/MatthewAlgo/TradeLens/services/oms/internal/config"
	"github.com/MatthewAlgo/TradeLens/services/oms/internal/engine"
	"github.com/MatthewAlgo/TradeLens/services/oms/internal/models"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)
	slog.Info("Starting TradeLens Order Management System")

	cfg := config.Load()

	// Initialize the OMS engine
	oms := engine.New(cfg.InitialBalance, cfg.CommissionRate, cfg.SlippageBPS)
	slog.Info("OMS engine initialized",
		"balance", cfg.InitialBalance,
		"commission", cfg.CommissionRate,
		"slippage_bps", cfg.SlippageBPS)

	// Start price feed consumer (for triggering stop/limit orders)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go oms.StartPriceFeed(ctx, cfg.RedpandaBrokers)

	// HTTP API
	mux := http.NewServeMux()

	// Submit order
	mux.HandleFunc("POST /api/orders", func(w http.ResponseWriter, r *http.Request) {
		var req models.OrderRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		order, err := oms.SubmitOrder(req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(order)
	})

	// Get all orders
	mux.HandleFunc("GET /api/orders", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(oms.GetOrders())
	})

	// Cancel order
	mux.HandleFunc("DELETE /api/orders/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if err := oms.CancelOrder(id); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})

	// Get portfolio
	mux.HandleFunc("GET /api/portfolio", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(oms.GetPortfolio())
	})

	// Get positions
	mux.HandleFunc("GET /api/positions", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(oms.GetPositions())
	})

	// Health check
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	// CORS middleware
	handler := corsMiddleware(mux)

	port := cfg.Port
	if !strings.HasPrefix(port, ":") {
		port = ":" + port
	}

	server := &http.Server{
		Addr:    port,
		Handler: handler,
	}

	go func() {
		slog.Info("OMS HTTP server starting", "port", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("HTTP server error", "error", err)
		}
	}()

	// Graceful shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh
	slog.Info("Shutdown signal received")
	cancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	server.Shutdown(shutdownCtx)

	slog.Info("OMS stopped")
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func init() {
	// Suppress unused import warning
	_ = fmt.Sprintf
}
