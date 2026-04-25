-- ============================================
-- 004: Footprint Volume-at-Price Data
-- ============================================

CREATE TABLE IF NOT EXISTS footprints (
    time            TIMESTAMPTZ NOT NULL,
    instrument_id   INTEGER NOT NULL,
    interval        VARCHAR(8) NOT NULL,
    price_level     NUMERIC(20, 10) NOT NULL,       -- Grouped price level
    tick_grouping   INTEGER NOT NULL DEFAULT 100,    -- Price grouping factor (cents)
    bid_volume      NUMERIC(20, 10) NOT NULL DEFAULT 0,  -- Aggressive sells
    ask_volume      NUMERIC(20, 10) NOT NULL DEFAULT 0,  -- Aggressive buys
    delta           NUMERIC(20, 10) NOT NULL DEFAULT 0,  -- ask - bid
    total_volume    NUMERIC(20, 10) NOT NULL DEFAULT 0
);

SELECT create_hypertable('footprints', 'time', if_not_exists => TRUE);

ALTER TABLE footprints SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'instrument_id,interval',
    timescaledb.compress_orderby = 'time DESC'
);

SELECT add_compression_policy('footprints', INTERVAL '14 days', if_not_exists => TRUE);

-- Query pattern: all footprint levels for a candle
CREATE INDEX IF NOT EXISTS idx_footprints_lookup
    ON footprints (instrument_id, interval, time DESC);

-- Unique constraint for upserts
CREATE UNIQUE INDEX IF NOT EXISTS idx_footprints_unique
    ON footprints (instrument_id, interval, time, price_level, tick_grouping);
