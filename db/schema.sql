-- ProQuote 2.1 — PostgreSQL schema
-- Run once: psql -d proquote -f db/schema.sql

-- All workspace key-value storage (mirrors localStorage keys).
-- One row per (key, user_id) pair so each user has an isolated namespace.
CREATE TABLE IF NOT EXISTS settings (
  id          BIGSERIAL PRIMARY KEY,
  key         TEXT NOT NULL,
  value       TEXT,               -- stored as raw string, same as localStorage
  user_id     INTEGER REFERENCES users(id),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (key, user_id)
);

-- Quotes — each row is one quote tab.
-- The full quote state (sections, parents, subitems, fields) lives in `data`.
CREATE TABLE IF NOT EXISTS quotes (
  id          TEXT PRIMARY KEY,
  name        TEXT,
  data        JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Users table — stores hashed credentials
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  biz_name      TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_settings_user ON settings(user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_user   ON quotes(user_id);

-- Trigger to auto-update updated_at on quotes
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS quotes_updated_at ON quotes;
CREATE TRIGGER quotes_updated_at
  BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS settings_updated_at ON settings;
CREATE TRIGGER settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Wholesaler accounts (e.g. electrical supply houses) and the charges
-- logged against them. Balance = SUM(amount) WHERE paid = FALSE.
-- "Mark paid" flips all currently-unpaid charges to paid, starting a new cycle.
CREATE TABLE IF NOT EXISTS wholesalers (
  id         TEXT NOT NULL,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  name       TEXT NOT NULL DEFAULT '',
  notes      TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, user_id)
);

CREATE TABLE IF NOT EXISTS wholesaler_charges (
  id            TEXT NOT NULL,
  wholesaler_id TEXT NOT NULL,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  amount        NUMERIC(12,2) NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  charge_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  paid          BOOLEAN NOT NULL DEFAULT FALSE,
  paid_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_wholesalers_user       ON wholesalers(user_id);
CREATE INDEX IF NOT EXISTS idx_wh_charges_wholesaler   ON wholesaler_charges(wholesaler_id, user_id);
