// Package adapters provides exchange-specific WebSocket adapters.
package adapters

import "context"

// ExchangeAdapter defines the interface for connecting to market data sources.
type ExchangeAdapter interface {
	// Connect establishes a WebSocket connection and streams normalized tick data
	// as JSON bytes to the provided channel.
	Connect(ctx context.Context, tickCh chan<- []byte) error
}
