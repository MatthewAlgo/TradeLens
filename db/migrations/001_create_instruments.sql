-- ============================================
-- 001: Instrument Master Database
-- ============================================
-- Maps internal IDs to exchange-specific tickers

CREATE TABLE IF NOT EXISTS instruments (
    id              SERIAL PRIMARY KEY,
    symbol          VARCHAR(32) NOT NULL UNIQUE,    -- Internal: "BTCUSDT"
    base_asset      VARCHAR(16) NOT NULL,           -- "BTC"
    quote_asset     VARCHAR(16) NOT NULL,           -- "USDT"
    asset_class     VARCHAR(16) NOT NULL DEFAULT 'crypto',  -- crypto, equity, forex, futures
    tick_size       NUMERIC(20, 10) NOT NULL,       -- Min price increment
    lot_size        NUMERIC(20, 10) NOT NULL,       -- Min quantity increment
    min_notional    NUMERIC(20, 10) DEFAULT 0,      -- Min order value
    status          VARCHAR(16) NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Exchange-specific symbol mappings
CREATE TABLE IF NOT EXISTS instrument_mappings (
    id              SERIAL PRIMARY KEY,
    instrument_id   INTEGER NOT NULL REFERENCES instruments(id),
    exchange        VARCHAR(32) NOT NULL,           -- "binance", "bybit", "coinbase"
    exchange_symbol VARCHAR(64) NOT NULL,           -- Exchange-specific symbol
    UNIQUE(instrument_id, exchange)
);

-- Seed default instruments
INSERT INTO instruments (symbol, base_asset, quote_asset, asset_class, tick_size, lot_size, min_notional)
VALUES
    ('BTCUSDT', 'BTC', 'USDT', 'crypto', 0.01, 0.00001, 10),
    ('ETHUSDT', 'ETH', 'USDT', 'crypto', 0.01, 0.0001, 10),
    ('SOLUSDT', 'SOL', 'USDT', 'crypto', 0.01, 0.01, 10),
    ('BNBUSDT', 'BNB', 'USDT', 'crypto', 0.01, 0.001, 10)
ON CONFLICT (symbol) DO NOTHING;

INSERT INTO instrument_mappings (instrument_id, exchange, exchange_symbol)
SELECT id, 'binance', symbol FROM instruments WHERE asset_class = 'crypto'
ON CONFLICT DO NOTHING;
