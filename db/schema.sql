-- ProQuote 2.1 — PostgreSQL schema
-- Run once: psql -d proquote -f db/schema.sql

-- All workspace key-value storage (mirrors localStorage keys).
-- One row per key. Value is stored as JSONB (raw strings wrapped in quotes, objects/arrays as-is).
CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT,               -- stored as raw string, same as localStorage
  updated_at  TIMESTAMPTZ DEFAULT NOW()
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

ALTER TABLE settings ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
ALTER TABLE quotes   ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);

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
