-- Migration: make settings table per-user so each user has an isolated key namespace.
-- Run once against the live Railway database:
--   psql $DATABASE_URL -f db/migrate-settings-per-user.sql

-- 1. Drop the old global primary key on (key)
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_pkey;

-- 2. Add an auto-increment surrogate primary key
ALTER TABLE settings ADD COLUMN IF NOT EXISTS id BIGSERIAL;
ALTER TABLE settings ADD CONSTRAINT settings_pkey PRIMARY KEY (id);

-- 3. Remove any duplicate (key) rows, keeping the one with the highest updated_at
--    (safe no-op if there's only one user or no duplicates)
DELETE FROM settings a
USING settings b
WHERE a.key = b.key
  AND a.id < b.id;

-- 4. Add the per-user unique constraint
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_key_user;
ALTER TABLE settings ADD CONSTRAINT settings_key_user UNIQUE (key, user_id);
