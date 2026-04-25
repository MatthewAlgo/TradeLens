// Package normalizer transforms raw exchange payloads into the ingester tick shape.
package normalizer

import "strconv"

// Tick is the normalized payload emitted by adapters.
type Tick struct {
	TimestampMs  int64   `json:"timestamp_ms"`
	Symbol       string  `json:"symbol"`
	Price        float64 `json:"price"`
	Quantity     float64 `json:"quantity"`
	IsBuyerMaker bool    `json:"is_buyer_maker"`
	TradeID      int64   `json:"trade_id"`
	Exchange     string  `json:"exchange"`
}

// ParseFloat returns 0 when conversion fails.
func ParseFloat(value string) float64 {
	v, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return 0
	}
	return v
}

// BuildTick creates a normalized tick value.
func BuildTick(timestampMs int64, symbol, price, quantity string, isBuyerMaker bool, tradeID int64, exchange string) Tick {
	return Tick{
		TimestampMs:  timestampMs,
		Symbol:       symbol,
		Price:        ParseFloat(price),
		Quantity:     ParseFloat(quantity),
		IsBuyerMaker: isBuyerMaker,
		TradeID:      tradeID,
		Exchange:     exchange,
	}
}
