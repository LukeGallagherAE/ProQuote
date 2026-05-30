require('dotenv').config({ path: require('path').join(__dirname, '.env') });
// Force IPv4 DNS resolution — Railway's network doesn't support IPv6
require('dns').setDefaultResultOrder('ipv4first');
const express     = require('express');
const compression = require('compression');
const cors        = require('cors');
const path        = require('path');
const fs          = require('fs');
const bcrypt      = require('bcryptjs');

const storageRoutes  = require('./routes/storage');
const quotesRoutes   = require('./routes/quotes');
const emailRoutes    = require('./routes/email');
const authRoutes     = require('./routes/auth');
const requireAuth    = require('./middleware/requireAuth');
const db             = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' })); // large limit — quotes can contain base64 photos
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth',    authRoutes);
app.use('/api/storage', storageRoutes);
app.use('/api/quotes',  quotesRoutes);
app.use('/api/email',   requireAuth, emailRoutes);
app.use('/api/ai',      require('./routes/ai'));
app.use('/api/pdf',     requireAuth, require('./routes/pdf'));

// Health check + build info
const _buildDate = (() => {
  try { return fs.statSync(path.join(__dirname, 'public', 'index.html')).mtime; } catch { return new Date(); }
})();
app.get('/api/health',     (req, res) => res.json({ ok: true, built: _buildDate.toISOString() }));
app.get('/api/build-info', (req, res) => res.json({ built: _buildDate.toISOString() }));

// Serve the app for any non-API route (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Auth migration ────────────────────────────────────────────────────────────
// Runs at startup. Ensures the users table exists, then migrates any legacy
// plain-text credentials from the settings table into the users table.
async function migrateAuth() {
  try {
    // 1. Ensure users table and new columns exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            SERIAL PRIMARY KEY,
        username      TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        biz_name      TEXT DEFAULT '',
        created_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await db.query(`ALTER TABLE settings ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)`);
    await db.query(`ALTER TABLE quotes   ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_settings_user ON settings(user_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_quotes_user   ON quotes(user_id)`);


    // 2. Check if users table is empty
    const { rows: countRows } = await db.query('SELECT COUNT(*)::int AS count FROM users');
    if (countRows[0].count > 0) {
      console.log('[ProQuote] Auth migration: users table already populated — skipping.');
      return;
    }

    // 3. Look for legacy proquote_auth in settings
    const { rows: authRows } = await db.query(
      "SELECT value FROM settings WHERE key = 'proquote_auth'"
    );
    if (!authRows.length || !authRows[0].value) {
      console.log('[ProQuote] Auth migration: no legacy proquote_auth found — nothing to migrate.');
      return;
    }

    let legacy;
    try {
      legacy = JSON.parse(authRows[0].value);
    } catch (e) {
      console.warn('[ProQuote] Auth migration: could not parse proquote_auth JSON — skipping.');
      return;
    }

    const username = legacy.username || legacy.name || 'admin';
    const password = legacy.password || '';
    const bizName  = legacy.biz      || legacy.name || '';

    if (!password) {
      console.warn('[ProQuote] Auth migration: legacy record has no password — skipping.');
      return;
    }

    // 4. Hash the password and insert the user
    const hash = await bcrypt.hash(password, 12);
    const { rows: insertRows } = await db.query(
      'INSERT INTO users (username, password_hash, biz_name) VALUES ($1, $2, $3) RETURNING id',
      [username, hash, bizName]
    );
    const newId = insertRows[0].id;
    console.log(`[ProQuote] Auth migration: created user "${username}" (id=${newId}) from legacy auth.`);

    // 5. Assign all existing settings rows to this user
    const { rowCount: sCount } = await db.query(
      'UPDATE settings SET user_id = $1 WHERE user_id IS NULL',
      [newId]
    );
    console.log(`[ProQuote] Auth migration: assigned ${sCount} settings rows to user ${newId}.`);

    // 6. Assign all existing quotes rows to this user
    const { rowCount: qCount } = await db.query(
      'UPDATE quotes SET user_id = $1 WHERE user_id IS NULL',
      [newId]
    );
    console.log(`[ProQuote] Auth migration: assigned ${qCount} quotes rows to user ${newId}.`);

    // 7. Remove the legacy plain-text auth key
    await db.query("DELETE FROM settings WHERE key = 'proquote_auth'");
    console.log('[ProQuote] Auth migration: deleted legacy proquote_auth key from settings.');

  } catch (err) {
    console.error('[ProQuote] Auth migration failed:', err);
  }
}

// Optional: upsert a user from env vars — useful for account recovery.
// Set SEED_USERNAME + SEED_PASSWORD in Railway env, redeploy once, then remove them.
async function seedUser() {
  const seedUser = process.env.SEED_USERNAME;
  const seedPass = process.env.SEED_PASSWORD;
  if (!seedUser || !seedPass) return;
  try {
    const hash = await bcrypt.hash(seedPass, 12);
    await db.query(
      `INSERT INTO users (username, password_hash, biz_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (username) DO UPDATE
         SET password_hash = EXCLUDED.password_hash`,
      [seedUser, hash, seedUser]
    );
    console.log(`[ProQuote] Seeded/updated user "${seedUser}" from SEED_USERNAME env var.`);
  } catch (err) {
    console.error('[ProQuote] seedUser failed:', err);
  }
}

// Run migration then start listening
migrateAuth().then(() => seedUser()).then(() => {
  app.listen(PORT, () => {
    console.log(`ProQuote 2.1 running at http://localhost:${PORT}`);
  });
});
