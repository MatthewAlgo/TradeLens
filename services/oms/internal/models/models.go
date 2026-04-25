package models

import "time"

// OrderRequest represents a new order submission.
type OrderRequest struct {
	Symbol    string  `json:"symbol"`
	Side      string  `json:"side"`       // "BUY" or "SELL"
	OrderType string  `json:"order_type"` // "MARKET", "LIMIT", "STOP_LOSS", "TAKE_PROFIT"
	Quantity  float64 `json:"quantity"`
	Price     float64 `json:"price,omitempty"`      // For LIMIT orders
	StopPrice float64 `json:"stop_price,omitempty"` // For STOP_LOSS/TAKE_PROFIT
}

// Order represents a full order in the system.
type Order struct {
	ID             string    `json:"id"`
	Symbol         string    `json:"symbol"`
	Side           string    `json:"side"`
	OrderType      string    `json:"order_type"`
	Status         string    `json:"status"` // PENDING, OPEN, FILLED, CANCELLED, REJECTED
	Quantity       float64   `json:"quantity"`
	FilledQuantity float64   `json:"filled_quantity"`
	Price          float64   `json:"price,omitempty"`
	StopPrice      float64   `json:"stop_price,omitempty"`
	AvgFillPrice   float64   `json:"avg_fill_price,omitempty"`
	Commission     float64   `json:"commission"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
	FilledAt       *time.Time `json:"filled_at,omitempty"`
}

// Position represents an open position.
type Position struct {
	Symbol        string  `json:"symbol"`
	Side          string  `json:"side"` // "LONG" or "SHORT"
	Quantity      float64 `json:"quantity"`
	AvgEntryPrice float64 `json:"avg_entry_price"`
	CurrentPrice  float64 `json:"current_price"`
	UnrealizedPnL float64 `json:"unrealized_pnl"`
	RealizedPnL   float64 `json:"realized_pnl"`
}

// Portfolio represents the user's account state.
type Portfolio struct {
	Balance       float64    `json:"balance"`
	LockedBalance float64    `json:"locked_balance"`
	TotalPnL      float64    `json:"total_pnl"`
	Positions     []Position `json:"positions"`
	OpenOrders    int        `json:"open_orders"`
}
