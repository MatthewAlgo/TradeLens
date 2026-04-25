// Package engine implements the paper trading engine.
package engine

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"strings"
	"sync"
	"time"

	"github.com/MatthewAlgo/TradeLens/services/oms/internal/models"
	"github.com/MatthewAlgo/TradeLens/services/oms/internal/portfolio"
	"github.com/segmentio/kafka-go"
)

// Engine is the core OMS engine for paper trading.
type Engine struct {
	mu             sync.RWMutex
	balance        float64
	lockedBalance  float64
	commissionRate float64
	slippageBPS    float64
	orders         map[string]*models.Order
	positions      map[string]*models.Position // key: symbol
	lastPrices     map[string]float64
	orderSeq       int
}

// tick from ingester
type internalTick struct {
	Symbol      string  `json:"symbol"`
	Price       float64 `json:"price"`
	TimestampMs int64   `json:"timestamp_ms"`
}

func New(initialBalance, commissionRate, slippageBPS float64) *Engine {
	return &Engine{
		balance:        initialBalance,
		commissionRate: commissionRate,
		slippageBPS:    slippageBPS,
		orders:         make(map[string]*models.Order),
		positions:      make(map[string]*models.Position),
		lastPrices:     make(map[string]float64),
	}
}

// SubmitOrder validates and processes a new order.
func (e *Engine) SubmitOrder(req models.OrderRequest) (*models.Order, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	// Validation
	if req.Quantity <= 0 {
		return nil, fmt.Errorf("quantity must be positive")
	}
	if req.Side != "BUY" && req.Side != "SELL" {
		return nil, fmt.Errorf("side must be BUY or SELL")
	}

	e.orderSeq++
	now := time.Now()
	order := &models.Order{
		ID:        fmt.Sprintf("ORD-%06d", e.orderSeq),
		Symbol:    req.Symbol,
		Side:      req.Side,
		OrderType: req.OrderType,
		Quantity:  req.Quantity,
		Price:     req.Price,
		StopPrice: req.StopPrice,
		CreatedAt: now,
		UpdatedAt: now,
	}

	switch req.OrderType {
	case "MARKET":
		return e.executeMarketOrder(order)
	case "LIMIT":
		if req.Price <= 0 {
			return nil, fmt.Errorf("limit order requires a price")
		}
		order.Status = "OPEN"
		e.orders[order.ID] = order
		return order, nil
	case "STOP_LOSS", "TAKE_PROFIT":
		if req.StopPrice <= 0 {
			return nil, fmt.Errorf("stop/TP order requires a stop_price")
		}
		order.Status = "OPEN"
		e.orders[order.ID] = order
		return order, nil
	default:
		return nil, fmt.Errorf("unsupported order type: %s", req.OrderType)
	}
}

func (e *Engine) executeMarketOrder(order *models.Order) (*models.Order, error) {
	lastPrice, ok := e.lastPrices[order.Symbol]
	if !ok {
		// If no price yet, reject
		lastPrice = 0
		order.Status = "REJECTED"
		e.orders[order.ID] = order
		return order, fmt.Errorf("no market price available for %s", order.Symbol)
	}

	// Apply slippage
	slippage := lastPrice * (e.slippageBPS / 10000.0)
	fillPrice := lastPrice
	if order.Side == "BUY" {
		fillPrice += slippage
	} else {
		fillPrice -= slippage
	}

	// Calculate cost and commission
	cost := fillPrice * order.Quantity
	commission := cost * e.commissionRate

	if order.Side == "BUY" {
		if e.balance < cost+commission {
			order.Status = "REJECTED"
			e.orders[order.ID] = order
			return order, fmt.Errorf("insufficient balance: need %.2f, have %.2f", cost+commission, e.balance)
		}
		e.balance -= (cost + commission)
	} else {
		e.balance += (cost - commission)
	}

	now := time.Now()
	order.Status = "FILLED"
	order.FilledQuantity = order.Quantity
	order.AvgFillPrice = fillPrice
	order.Commission = commission
	order.FilledAt = &now
	order.UpdatedAt = now
	e.orders[order.ID] = order

	// Update position
	e.updatePosition(order)

	slog.Info("Order filled",
		"id", order.ID,
		"symbol", order.Symbol,
		"side", order.Side,
		"qty", order.Quantity,
		"price", fillPrice,
		"commission", commission)

	return order, nil
}

func (e *Engine) updatePosition(order *models.Order) {
	pos, exists := e.positions[order.Symbol]

	if order.Side == "BUY" {
		if !exists {
			e.positions[order.Symbol] = &models.Position{
				Symbol:        order.Symbol,
				Side:          "LONG",
				Quantity:      order.FilledQuantity,
				AvgEntryPrice: order.AvgFillPrice,
			}
		} else if pos.Side == "LONG" {
			// Add to long position
			totalCost := pos.AvgEntryPrice*pos.Quantity + order.AvgFillPrice*order.FilledQuantity
			pos.Quantity += order.FilledQuantity
			pos.AvgEntryPrice = totalCost / pos.Quantity
		} else {
			// Closing short
			pnl := (pos.AvgEntryPrice - order.AvgFillPrice) * math.Min(pos.Quantity, order.FilledQuantity)
			pos.RealizedPnL += pnl
			pos.Quantity -= order.FilledQuantity
			if pos.Quantity <= 0 {
				delete(e.positions, order.Symbol)
			}
		}
	} else { // SELL
		if !exists {
			e.positions[order.Symbol] = &models.Position{
				Symbol:        order.Symbol,
				Side:          "SHORT",
				Quantity:      order.FilledQuantity,
				AvgEntryPrice: order.AvgFillPrice,
			}
		} else if pos.Side == "LONG" {
			// Closing long
			pnl := (order.AvgFillPrice - pos.AvgEntryPrice) * math.Min(pos.Quantity, order.FilledQuantity)
			pos.RealizedPnL += pnl
			pos.Quantity -= order.FilledQuantity
			if pos.Quantity <= 0 {
				delete(e.positions, order.Symbol)
			}
		} else {
			// Add to short
			totalCost := pos.AvgEntryPrice*pos.Quantity + order.AvgFillPrice*order.FilledQuantity
			pos.Quantity += order.FilledQuantity
			pos.AvgEntryPrice = totalCost / pos.Quantity
		}
	}
}

// CancelOrder cancels an open order.
func (e *Engine) CancelOrder(id string) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	order, ok := e.orders[id]
	if !ok {
		return fmt.Errorf("order not found: %s", id)
	}
	if order.Status != "OPEN" && order.Status != "PENDING" {
		return fmt.Errorf("cannot cancel order in status: %s", order.Status)
	}

	order.Status = "CANCELLED"
	order.UpdatedAt = time.Now()
	return nil
}

// GetOrders returns all orders.
func (e *Engine) GetOrders() []*models.Order {
	e.mu.RLock()
	defer e.mu.RUnlock()

	orders := make([]*models.Order, 0, len(e.orders))
	for _, o := range e.orders {
		orders = append(orders, o)
	}
	return orders
}

// GetPositions returns all open positions.
func (e *Engine) GetPositions() []*models.Position {
	e.mu.RLock()
	defer e.mu.RUnlock()

	positions := make([]*models.Position, 0, len(e.positions))
	for _, p := range e.positions {
		// Update unrealized PnL
		if price, ok := e.lastPrices[p.Symbol]; ok {
			p.CurrentPrice = price
			if p.Side == "LONG" {
				p.UnrealizedPnL = portfolio.UnrealizedLong(price, p.AvgEntryPrice, p.Quantity)
			} else {
				p.UnrealizedPnL = portfolio.UnrealizedShort(price, p.AvgEntryPrice, p.Quantity)
			}
		}
		positions = append(positions, p)
	}
	return positions
}

// GetPortfolio returns the portfolio summary.
func (e *Engine) GetPortfolio() *models.Portfolio {
	e.mu.RLock()
	defer e.mu.RUnlock()

	positions := make([]models.Position, 0)
	totalPnL := 0.0
	openOrders := 0

	for _, p := range e.positions {
		if price, ok := e.lastPrices[p.Symbol]; ok {
			p.CurrentPrice = price
			if p.Side == "LONG" {
				p.UnrealizedPnL = portfolio.UnrealizedLong(price, p.AvgEntryPrice, p.Quantity)
			} else {
				p.UnrealizedPnL = portfolio.UnrealizedShort(price, p.AvgEntryPrice, p.Quantity)
			}
		}
		totalPnL += p.UnrealizedPnL + p.RealizedPnL
		positions = append(positions, *p)
	}

	for _, o := range e.orders {
		if o.Status == "OPEN" {
			openOrders++
		}
	}

	return &models.Portfolio{
		Balance:       e.balance,
		LockedBalance: e.lockedBalance,
		TotalPnL:      totalPnL,
		Positions:     positions,
		OpenOrders:    openOrders,
	}
}

// StartPriceFeed consumes price updates from Redpanda to trigger pending orders.
func (e *Engine) StartPriceFeed(ctx context.Context, brokers string) {
	brokerList := strings.Split(brokers, ",")
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:  brokerList,
		Topic:    "raw_ticks",
		GroupID:  "oms-price-feed",
		MinBytes: 1,
		MaxBytes: 10e6,
	})
	defer reader.Close()

	slog.Info("OMS price feed started")

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		msg, err := reader.ReadMessage(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			continue
		}

		var tick internalTick
		if err := json.Unmarshal(msg.Value, &tick); err != nil {
			continue
		}

		e.mu.Lock()
		e.lastPrices[tick.Symbol] = tick.Price

		// Check for triggerable stop/limit orders
		for _, order := range e.orders {
			if order.Status != "OPEN" || order.Symbol != tick.Symbol {
				continue
			}

			triggered := false
			switch order.OrderType {
			case "LIMIT":
				if order.Side == "BUY" && tick.Price <= order.Price {
					triggered = true
				} else if order.Side == "SELL" && tick.Price >= order.Price {
					triggered = true
				}
			case "STOP_LOSS":
				if order.Side == "SELL" && tick.Price <= order.StopPrice {
					triggered = true
				} else if order.Side == "BUY" && tick.Price >= order.StopPrice {
					triggered = true
				}
			case "TAKE_PROFIT":
				if order.Side == "SELL" && tick.Price >= order.StopPrice {
					triggered = true
				} else if order.Side == "BUY" && tick.Price <= order.StopPrice {
					triggered = true
				}
			}

			if triggered {
				e.executeMarketOrder(order)
			}
		}
		e.mu.Unlock()
	}
}
