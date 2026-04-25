// Package portfolio provides reusable position PnL math helpers.
package portfolio

// UnrealizedLong returns unrealized PnL for a long position.
func UnrealizedLong(currentPrice, avgEntry, qty float64) float64 {
	return (currentPrice - avgEntry) * qty
}

// UnrealizedShort returns unrealized PnL for a short position.
func UnrealizedShort(currentPrice, avgEntry, qty float64) float64 {
	return (avgEntry - currentPrice) * qty
}
