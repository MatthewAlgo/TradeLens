-- ============================================
-- 003: OHLCV Candle Data (TimescaleDB Hypertable)
-- ============================================

CREATE TABLE IF NOT EXISTS candles (
    time            TIMESTAMPTZ NOT NULL,
    instrument_id   INTEGER NOT NULL,
    interval        VARCHAR(8) NOT NULL,            -- "1m", "5m", "15m", "1h", "4h", "1d"
    open            NUMERIC(20, 10) NOT NULL,
    high            NUMERIC(20, 10) NOT NULL,
    low             NUMERIC(20, 10) NOT NULL,
    close           NUMERIC(20, 10) NOT NULL,
    volume          NUMERIC(20, 10) NOT NULL DEFAULT 0,
    trade_count     INTEGER NOT NULL DEFAULT 0,
    is_closed       BOOLEAN NOT NULL DEFAULT FALSE
);

SELECT create_hypertable('candles', 'time', if_not_exists => TRUE);

-- Compression for older data
ALTER TABLE candles SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'instrument_id,interval',
    timescaledb.compress_orderby = 'time DESC'
);

SELECT add_compression_policy('candles', INTERVAL '30 days', if_not_exists => TRUE);

-- Primary query pattern: fetch candles for a symbol and interval
CREATE INDEX IF NOT EXISTS idx_candles_lookup
    ON candles (instrument_id, interval, time DESC);

-- Unique constraint to enable upserts
CREATE UNIQUE INDEX IF NOT EXISTS idx_candles_unique
    ON candles (instrument_id, interval, time);
