// Package writer provides TimescaleDB write operations for candles and footprints.
package writer

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"time"

	_ "github.com/lib/pq"
)

// Writer handles database writes to TimescaleDB.
type Writer struct {
	db *sql.DB
}

// New creates a new TimescaleDB writer.
func New(dsn string) (*Writer, error) {
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	slog.Info("Connected to TimescaleDB")
	return &Writer{db: db}, nil
}

// WriteCandle upserts an OHLCV candle.
func (w *Writer) WriteCandle(openTime time.Time, symbol, interval string,
	open, high, low, close, volume float64, tradeCount int) error {

	// Resolve instrument_id from symbol
	instrumentID, err := w.getInstrumentID(symbol)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO candles (time, instrument_id, interval, open, high, low, close, volume, trade_count, is_closed)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)
		ON CONFLICT (instrument_id, interval, time) DO UPDATE SET
			high = GREATEST(candles.high, EXCLUDED.high),
			low = LEAST(candles.low, EXCLUDED.low),
			close = EXCLUDED.close,
			volume = EXCLUDED.volume,
			trade_count = EXCLUDED.trade_count,
			is_closed = EXCLUDED.is_closed
	`

	_, err = w.db.Exec(query, openTime, instrumentID, interval,
		open, high, low, close, volume, tradeCount)
	return err
}

// WriteFootprint upserts a footprint level.
func (w *Writer) WriteFootprint(openTime time.Time, symbol, interval string,
	priceLevel float64, tickGrouping int,
	bidVolume, askVolume, delta, totalVolume float64) error {

	instrumentID, err := w.getInstrumentID(symbol)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO footprints (time, instrument_id, interval, price_level, tick_grouping,
			bid_volume, ask_volume, delta, total_volume)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		ON CONFLICT (instrument_id, interval, time, price_level, tick_grouping) DO UPDATE SET
			bid_volume = EXCLUDED.bid_volume,
			ask_volume = EXCLUDED.ask_volume,
			delta = EXCLUDED.delta,
			total_volume = EXCLUDED.total_volume
	`

	_, err = w.db.Exec(query, openTime, instrumentID, interval,
		priceLevel, tickGrouping, bidVolume, askVolume, delta, totalVolume)
	return err
}

func (w *Writer) getInstrumentID(symbol string) (int, error) {
	var id int
	err := w.db.QueryRow("SELECT id FROM instruments WHERE symbol = $1", symbol).Scan(&id)
	if err != nil {
		// Auto-create if not found
		err = w.db.QueryRow(
			`INSERT INTO instruments (symbol, base_asset, quote_asset, tick_size, lot_size)
			 VALUES ($1, '', '', 0.01, 0.00001)
			 ON CONFLICT (symbol) DO UPDATE SET symbol = EXCLUDED.symbol
			 RETURNING id`, symbol).Scan(&id)
		if err != nil {
			return 0, fmt.Errorf("failed to resolve instrument: %w", err)
		}
	}
	return id, nil
}

// Close shuts down the database connection.
func (w *Writer) Close() {
	w.db.Close()
}
