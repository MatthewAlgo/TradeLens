// Package engine implements the paper trading engine.
package engine

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"math/rand"
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
	orderProducer  *kafka.Writer // publishes order events to Kafka
}

// tick from ingester
type internalTick struct {
	Symbol      string  `json:"symbol"`
	Price       float64 `json:"price"`
	TimestampMs int64   `json:"timestamp_ms"`
}

func New(initialBalance, commissionRate, slippageBPS float64, brokers string) *Engine {
	e := &Engine{
		balance:        initialBalance,
		commissionRate: commissionRate,
		slippageBPS:    slippageBPS,
		orders:         make(map[string]*models.Order),
		positions:      make(map[string]*models.Position),
		lastPrices:     make(map[string]float64),
	}

	// Initialize Kafka producer for order events if brokers are configured
	if brokers != "" {
		brokerList := strings.Split(brokers, ",")
		e.orderProducer = &kafka.Writer{
			Addr:         kafka.TCP(brokerList...),
			Topic:        "order_events",
			Balancer:     &kafka.Hash{},
			BatchSize:    10,
			BatchTimeout: 50 * time.Millisecond,
			Async:        true,
			RequiredAcks: kafka.RequireOne,
		}
		slog.Info("OMS order event producer initialized", "topic", "order_events")
	}

	return e
}

// publishOrderEvent sends an order state change to the order_events Kafka topic.
func (e *Engine) publishOrderEvent(order *models.Order) {
	if e.orderProducer == nil {
		return
	}

	event := map[string]interface{}{
		"event": "order_update",
		"order": order,
	}

	data, err := json.Marshal(event)
	if err != nil {
		slog.Error("Failed to marshal order event", "error", err)
		return
	}

	if pubErr := e.orderProducer.WriteMessages(context.Background(), kafka.Message{
		Key:   []byte(order.Symbol),
		Value: data,
		Time:  time.Now(),
	}); pubErr != nil {
		slog.Error("Failed to publish order event", "error", pubErr, "orderID", order.ID)
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
		Quantity:       req.Quantity,
		Price:          req.Price,
		StopPrice:      req.StopPrice,
		TimeInForce:    req.TimeInForce,
		PostOnly:       req.PostOnly,
		TrailingOffset: req.TrailingOffset,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	switch req.OrderType {
	case "MARKET":
		return e.executeOrderCross(order)
	case "LIMIT":
		if req.Price <= 0 {
			return nil, fmt.Errorf("limit order requires a price")
		}
		lastPrice := e.lastPrices[order.Symbol]
		crossesSpread := false
		if lastPrice > 0 {
			if order.Side == "BUY" && order.Price >= lastPrice {
				crossesSpread = true
			} else if order.Side == "SELL" && order.Price <= lastPrice {
				crossesSpread = true
			}
		}

		if req.PostOnly && crossesSpread {
			order.Status = "REJECTED"
			e.orders[order.ID] = order
			return order, fmt.Errorf("post-only order would cross the spread")
		}

		if crossesSpread && (req.TimeInForce == "IOC" || req.TimeInForce == "FOK" || req.TimeInForce == "" || req.TimeInForce == "GTC") {
			return e.executeOrderCross(order)
		}

		order.Status = "OPEN"
		e.orders[order.ID] = order
		return order, nil
	case "STOP_LOSS", "TAKE_PROFIT", "TRAILING_STOP":
		if req.OrderType != "TRAILING_STOP" && req.StopPrice <= 0 {
			return nil, fmt.Errorf("stop/TP order requires a stop_price")
		}
		if req.OrderType == "TRAILING_STOP" && req.TrailingOffset <= 0 {
			return nil, fmt.Errorf("trailing stop requires a trailing_offset")
		}
		if req.OrderType == "TRAILING_STOP" {
			lastPrice := e.lastPrices[order.Symbol]
			if lastPrice > 0 {
				if order.Side == "SELL" {
					order.StopPrice = lastPrice - order.TrailingOffset
				} else {
					order.StopPrice = lastPrice + order.TrailingOffset
				}
			}
		}
		order.Status = "OPEN"
		e.orders[order.ID] = order
		return order, nil
	default:
		return nil, fmt.Errorf("unsupported order type: %s", req.OrderType)
	}
}

func (e *Engine) executeOrderCross(order *models.Order) (*models.Order, error) {
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

	// Partial fill simulation: 50% to 100% fill if quantity is large
	fillRatio := 1.0
	if order.Quantity > 1.0 && order.TimeInForce != "FOK" {
		fillRatio = 0.5 + rand.Float64()*0.5
	}
	
	remainingQty := order.Quantity - order.FilledQuantity
	fillQty := remainingQty * fillRatio
	
	// FOK must fill completely
	if order.TimeInForce == "FOK" && fillRatio < 1.0 {
		order.Status = "CANCELLED"
		e.orders[order.ID] = order
		return order, fmt.Errorf("fok order could not be fully filled")
	}

	cost := fillPrice * fillQty
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
	order.FilledQuantity += fillQty
	order.AvgFillPrice = fillPrice // Simplified: in reality this is volume-weighted
	order.Commission += commission
	order.FilledAt = &now
	order.UpdatedAt = now

	if order.FilledQuantity >= order.Quantity*0.999 {
		order.Status = "FILLED"
		order.FilledQuantity = order.Quantity
	} else if order.TimeInForce == "IOC" || order.OrderType == "MARKET" {
		// IOC and Market cancel the remaining
		order.Status = "CANCELLED"
	} else {
		order.Status = "OPEN"
	}
	
	e.orders[order.ID] = order

	// Update position
	e.updatePosition(order, fillQty)

	slog.Info("Order executed",
		"id", order.ID,
		"symbol", order.Symbol,
		"side", order.Side,
		"fillQty", fillQty,
		"price", fillPrice,
		"commission", commission,
		"status", order.Status)

	// Publish order event to Kafka for the WS bridge
	e.publishOrderEvent(order)

	return order, nil
}

func (e *Engine) updatePosition(order *models.Order, fillQty float64) {
	pos, exists := e.positions[order.Symbol]

	if order.Side == "BUY" {
		if !exists {
			e.positions[order.Symbol] = &models.Position{
				Symbol:        order.Symbol,
				Side:          "LONG",
				Quantity:      fillQty,
				AvgEntryPrice: order.AvgFillPrice,
			}
		} else if pos.Side == "LONG" {
			// Add to long position
			totalCost := pos.AvgEntryPrice*pos.Quantity + order.AvgFillPrice*fillQty
			pos.Quantity += fillQty
			pos.AvgEntryPrice = totalCost / pos.Quantity
		} else {
			// Closing short
			pnl := (pos.AvgEntryPrice - order.AvgFillPrice) * math.Min(pos.Quantity, fillQty)
			pos.RealizedPnL += pnl
			pos.Quantity -= fillQty
			if pos.Quantity <= 0 {
				delete(e.positions, order.Symbol)
			}
		}
	} else { // SELL
		if !exists {
			e.positions[order.Symbol] = &models.Position{
				Symbol:        order.Symbol,
				Side:          "SHORT",
				Quantity:      fillQty,
				AvgEntryPrice: order.AvgFillPrice,
			}
		} else if pos.Side == "LONG" {
			// Closing long
			pnl := (order.AvgFillPrice - pos.AvgEntryPrice) * math.Min(pos.Quantity, fillQty)
			pos.RealizedPnL += pnl
			pos.Quantity -= fillQty
			if pos.Quantity <= 0 {
				delete(e.positions, order.Symbol)
			}
		} else {
			// Add to short
			totalCost := pos.AvgEntryPrice*pos.Quantity + order.AvgFillPrice*fillQty
			pos.Quantity += fillQty
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

	// Publish cancellation event
	e.publishOrderEvent(order)

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
			case "TRAILING_STOP":
				if order.Side == "SELL" {
					if tick.Price-order.TrailingOffset > order.StopPrice {
						order.StopPrice = tick.Price - order.TrailingOffset
					}
					if tick.Price <= order.StopPrice {
						triggered = true
					}
				} else {
					if tick.Price+order.TrailingOffset < order.StopPrice || order.StopPrice == 0 {
						order.StopPrice = tick.Price + order.TrailingOffset
					}
					if tick.Price >= order.StopPrice {
						triggered = true
					}
				}
			}

			if triggered {
				e.executeOrderCross(order)
			}
		}
		e.mu.Unlock()
	}
}
