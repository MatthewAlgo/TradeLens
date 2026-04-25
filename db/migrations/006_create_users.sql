-- ============================================
-- 006: Users & Authentication
-- ============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    username        VARCHAR(64) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(16) NOT NULL DEFAULT 'trader'
                    CHECK (role IN ('trader', 'admin')),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    settings        JSONB DEFAULT '{}'::jsonb,      -- UI preferences, default layout
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default demo user (password: "demo1234" — bcrypt hash)
INSERT INTO users (email, username, password_hash, role)
VALUES ('demo@tradelens.io', 'demo', '$2b$12$LJ3m4yv6z0xJm5e3v4eOHe0z6x5y7w8q9r0s1t2u3v4w5x6y7z8a9', 'trader')
ON CONFLICT (email) DO NOTHING;

-- Create portfolio for demo user
INSERT INTO portfolios (user_id, balance)
SELECT id, 100000 FROM users WHERE username = 'demo'
ON CONFLICT (user_id) DO NOTHING;
