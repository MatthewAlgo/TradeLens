-- ============================================
-- 005: Orders & Trades (PostgreSQL)
-- ============================================
-- NOTE: This runs on the separate PostgreSQL instance (port 5433),
-- NOT on TimescaleDB. For local dev, it's auto-applied via
-- the api-gateway's migration runner.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    instrument_id   INTEGER NOT NULL,
    side            VARCHAR(4) NOT NULL CHECK (side IN ('BUY', 'SELL')),
    order_type      VARCHAR(16) NOT NULL CHECK (order_type IN ('MARKET', 'LIMIT', 'STOP_LOSS', 'TAKE_PROFIT')),
    status          VARCHAR(16) NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'OPEN', 'PARTIAL', 'FILLED', 'CANCELLED', 'REJECTED')),
    quantity        NUMERIC(20, 10) NOT NULL,
    filled_quantity NUMERIC(20, 10) NOT NULL DEFAULT 0,
    price           NUMERIC(20, 10),                -- NULL for MARKET orders
    stop_price      NUMERIC(20, 10),                -- For STOP_LOSS / TAKE_PROFIT
    avg_fill_price  NUMERIC(20, 10),
    commission      NUMERIC(20, 10) NOT NULL DEFAULT 0,
    slippage        NUMERIC(20, 10) NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    filled_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders (user_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_user_time ON orders (user_id, created_at DESC);

-- Fill history
CREATE TABLE IF NOT EXISTS fills (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES orders(id),
    price           NUMERIC(20, 10) NOT NULL,
    quantity        NUMERIC(20, 10) NOT NULL,
    commission      NUMERIC(20, 10) NOT NULL DEFAULT 0,
    filled_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fills_order ON fills (order_id);

-- Positions
CREATE TABLE IF NOT EXISTS positions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    instrument_id   INTEGER NOT NULL,
    side            VARCHAR(4) NOT NULL CHECK (side IN ('LONG', 'SHORT')),
    quantity        NUMERIC(20, 10) NOT NULL,
    avg_entry_price NUMERIC(20, 10) NOT NULL,
    unrealized_pnl  NUMERIC(20, 10) NOT NULL DEFAULT 0,
    realized_pnl    NUMERIC(20, 10) NOT NULL DEFAULT 0,
    opened_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at       TIMESTAMPTZ,
    UNIQUE(user_id, instrument_id, side)
);

CREATE INDEX IF NOT EXISTS idx_positions_user ON positions (user_id);

-- Portfolio / Account Balance
CREATE TABLE IF NOT EXISTS portfolios (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL UNIQUE,
    balance         NUMERIC(20, 10) NOT NULL DEFAULT 100000,
    locked_balance  NUMERIC(20, 10) NOT NULL DEFAULT 0,
    total_pnl       NUMERIC(20, 10) NOT NULL DEFAULT 0,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
