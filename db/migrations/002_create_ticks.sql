-- ============================================
-- 002: Raw Tick Data (TimescaleDB Hypertable)
-- ============================================

CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

CREATE TABLE IF NOT EXISTS ticks (
    time            TIMESTAMPTZ NOT NULL,
    instrument_id   INTEGER NOT NULL,
    price           NUMERIC(20, 10) NOT NULL,
    quantity        NUMERIC(20, 10) NOT NULL,
    is_buyer_maker  BOOLEAN NOT NULL,               -- true = aggressive sell
    trade_id        BIGINT,
    exchange        VARCHAR(32) NOT NULL DEFAULT 'binance'
);

-- Convert to TimescaleDB hypertable for optimal time-series performance
SELECT create_hypertable('ticks', 'time', if_not_exists => TRUE);

-- Compression policy: compress chunks older than 7 days
ALTER TABLE ticks SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'instrument_id',
    timescaledb.compress_orderby = 'time DESC'
);

SELECT add_compression_policy('ticks', INTERVAL '7 days', if_not_exists => TRUE);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_ticks_instrument_time ON ticks (instrument_id, time DESC);
