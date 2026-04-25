package engine

import (
	"testing"

	"github.com/MatthewAlgo/TradeLens/services/oms/internal/models"
)

func TestSubmitMarketOrderRequiresPriceFeed(t *testing.T) {
	e := New(1000.0, 0.001, 5.0)

	_, err := e.SubmitOrder(models.OrderRequest{
		Symbol:    "BTCUSDT",
		Side:      "BUY",
		OrderType: "MARKET",
		Quantity:  0.1,
	})

	if err == nil {
		t.Fatal("expected error without market price")
	}
}

func TestSubmitMarketOrderFillsWhenPriceAvailable(t *testing.T) {
	e := New(100000.0, 0.001, 5.0)
	e.lastPrices["BTCUSDT"] = 50000.0

	order, err := e.SubmitOrder(models.OrderRequest{
		Symbol:    "BTCUSDT",
		Side:      "BUY",
		OrderType: "MARKET",
		Quantity:  0.1,
	})

	if err != nil {
		t.Fatalf("expected fill, got err: %v", err)
	}
	if order.Status != "FILLED" {
		t.Fatalf("expected FILLED status, got %s", order.Status)
	}
}

func TestCancelOpenLimitOrder(t *testing.T) {
	e := New(100000.0, 0.001, 5.0)

	order, err := e.SubmitOrder(models.OrderRequest{
		Symbol:    "BTCUSDT",
		Side:      "BUY",
		OrderType: "LIMIT",
		Quantity:  0.1,
		Price:     49000.0,
	})
	if err != nil {
		t.Fatalf("submit order failed: %v", err)
	}

	if err := e.CancelOrder(order.ID); err != nil {
		t.Fatalf("cancel failed: %v", err)
	}

	if e.orders[order.ID].Status != "CANCELLED" {
		t.Fatalf("expected CANCELLED status, got %s", e.orders[order.ID].Status)
	}
}
