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
const clientsRoutes  = require('./routes/clients');
const emailRoutes    = require('./routes/email');
const authRoutes     = require('./routes/auth');
const requireAuth    = require('./middleware/requireAuth');
const db             = require('./db');
const { apiRouter: shareApiRouter, renderQuotePage } = require('./routes/share');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' })); // large limit — quotes can contain base64 photos
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth',    authRoutes);
app.use('/api/storage', storageRoutes);
app.use('/api/quotes',  quotesRoutes);
app.use('/api/clients',    clientsRoutes);
app.use('/api/pricelists', require('./routes/pricelists'));
app.use('/api/subimport', require('./routes/subimport'));
app.use('/api/email',   requireAuth, emailRoutes);
app.use('/api/ai',      require('./routes/ai'));
app.use('/api/pdf',     requireAuth, require('./routes/pdf'));
app.use('/api/share',   shareApiRouter);

// Public client quote pages — handles both new (quote_data) and legacy (html) links
app.get('/q/:token', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM quote_links WHERE token = $1', [req.params.token]);
    if (!rows.length) return res.status(404).send('<h1 style="font-family:sans-serif;padding:40px">Quote not found or link has expired.</h1>');
    const link = rows[0];
    // Legacy email-based links store pre-rendered HTML in the html column
    if (!link.quote_data && link.html) {
      res.set('Content-Type', 'text/html');
      return res.send(link.html);
    }
    res.send(renderQuotePage(link));
  } catch (err) {
    console.error('GET /q/:token:', err);
    res.status(500).send('<h1 style="font-family:sans-serif;padding:40px">Server error — please try again later.</h1>');
  }
});

app.post('/q/:token/accept', async (req, res) => {
  const { clientName, signature, selections } = req.body;
  if (!clientName) return res.status(400).json({ error: 'clientName required' });
  try {
    const { rows } = await db.query('SELECT accepted_at FROM quote_links WHERE token = $1', [req.params.token]);
    if (!rows.length) return res.status(404).json({ error: 'Quote not found' });
    if (rows[0].accepted_at) return res.json({ ok: true }); // idempotent
    await db.query(
      `UPDATE quote_links SET accepted_at=NOW(), client_name=$1, client_sig=$2, selections=$3 WHERE token=$4`,
      [clientName, signature || null, JSON.stringify(selections || {}), req.params.token]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /q/:token/accept:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Health check + build info
const _buildDate = (() => {
  try { return fs.statSync(path.join(__dirname, 'public', 'index.html')).mtime; } catch { return new Date(); }
})();
app.get('/api/health',     (req, res) => res.json({ ok: true, built: _buildDate.toISOString() }));
app.get('/api/build-info', (req, res) => res.json({ built: _buildDate.toISOString() }));

// ── Quote approve/decline — public, no auth ───────────────────────────────────
app.get('/api/quote-response', async (req, res) => {
  const { action, ref, client } = req.query;
  if (!action || !ref) return res.status(400).send('Missing action or ref');

  const isApprove = action === 'approve';
  const actionLabel = isApprove ? 'APPROVED ✓' : 'DECLINED ✗';
  const actionColor = isApprove ? '#34c759' : '#ff3b30';
  const icon        = isApprove ? '✅' : '❌';

  // Send notification email to business owner
  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = require('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      const owner = process.env.GMAIL_USER || 'luke@adonaielectrical.com';
      const fromAddr = `ProQuote <${owner}>`;
      await resend.emails.send({
        from:    fromAddr,
        to:      [owner],
        subject: `Quote ${actionLabel}: ${ref}${client ? ' — ' + client : ''}`,
        html: `<!DOCTYPE html><html><body style="font-family:-apple-system,Arial,sans-serif;font-size:14px;color:#1a1a1a;padding:24px">
          <div style="font-size:36px;margin-bottom:16px">${icon}</div>
          <h2 style="margin:0 0 8px;color:${actionColor}">${actionLabel}</h2>
          <p style="margin:0 0 4px"><strong>Quote:</strong> ${ref}</p>
          ${client ? `<p style="margin:0 0 16px"><strong>Client:</strong> ${client}</p>` : '<br>'}
          <p style="color:#888;font-size:12px">Sent via ProQuote — quote response button</p>
        </body></html>`,
      });
    } catch(e) {
      console.error('[ProQuote] Quote response email error:', e.message);
    }
  }

  // CORS headers so the exported HTML file can fetch this endpoint
  res.set('Access-Control-Allow-Origin', '*');

  // Return thank-you page
  res.send(`<!DOCTYPE html><html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Quote Response</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,Arial,sans-serif;background:#f5f5f7;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}</style>
</head>
<body>
  <div style="background:#fff;border-radius:16px;padding:48px 40px;text-align:center;max-width:420px;width:100%;box-shadow:0 4px 24px rgba(0,0,0,.08)">
    <div style="font-size:56px;margin-bottom:20px">${icon}</div>
    <h1 style="font-size:22px;font-weight:800;color:${actionColor};margin-bottom:10px">${isApprove ? 'Quote Approved!' : 'Quote Declined'}</h1>
    <p style="font-size:14px;color:#555;line-height:1.6;margin-bottom:24px">
      ${isApprove
        ? `Thank you for approving <strong>${ref}</strong>. We've been notified and will be in touch shortly to confirm next steps.`
        : `We've received your response for <strong>${ref}</strong>. We'll be in touch if you'd like to discuss any changes.`}
    </p>
    <p style="font-size:11px;color:#aaa">You can close this window.</p>
  </div>
</body></html>`);
});

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
    await db.query(`ALTER TABLE users    ADD COLUMN IF NOT EXISTS anthropic_api_key TEXT DEFAULT NULL`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_settings_user ON settings(user_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_quotes_user   ON quotes(user_id)`);
    await db.query(`
      CREATE TABLE IF NOT EXISTS quote_links (
        id          BIGSERIAL PRIMARY KEY,
        token       TEXT UNIQUE NOT NULL,
        user_id     INTEGER REFERENCES users(id),
        quote_data  JSONB,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        accepted_at TIMESTAMPTZ,
        client_name TEXT,
        client_sig  TEXT,
        selections  JSONB
      )
    `);
    // Backfill columns added after the original quote_links schema (ALTER is no-op if column already exists)
    await db.query(`ALTER TABLE quote_links ADD COLUMN IF NOT EXISTS quote_data  JSONB`);
    await db.query(`ALTER TABLE quote_links ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ`);
    await db.query(`ALTER TABLE quote_links ADD COLUMN IF NOT EXISTS client_name TEXT`);
    await db.query(`ALTER TABLE quote_links ADD COLUMN IF NOT EXISTS client_sig  TEXT`);
    await db.query(`ALTER TABLE quote_links ADD COLUMN IF NOT EXISTS selections  JSONB`);
    // The old schema had html TEXT NOT NULL — drop the NOT NULL so new rows (which use quote_data) can omit it
    await db.query(`ALTER TABLE quote_links ALTER COLUMN html DROP NOT NULL`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_quote_links_token ON quote_links(token)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_quote_links_user  ON quote_links(user_id)`);


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

// Start listening immediately — don't block on DB migration
app.listen(PORT, () => {
  console.log(`ProQuote 2.1 running at http://localhost:${PORT}`);
});

// ── Manual rebuild: POST /api/rebuild-clients ─────────────────────────────────
// Allows the user to trigger a client/job backfill from the UI at any time.
app.post('/api/rebuild-clients', async (req, res) => {
  const { requireAuth: _reqAuth } = require('./middleware/requireAuth');
  // Inline auth check
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const jwt = require('jsonwebtoken');
  let userId;
  try { userId = jwt.verify(token, process.env.JWT_SECRET || 'proquote-secret-change-me').userId; } catch { return res.status(401).json({ error: 'Unauthorized' }); }
  try {
    await migrateQuotesToClients();
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/rebuild-clients:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Clients/Jobs migration ────────────────────────────────────────────────────
// Creates the clients and jobs tables, then migrates any existing proquote_clients
// JSON blob (stored in the settings table) into the new relational tables.
async function migrateClients() {
  try {
    // 1. Create tables
    await db.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id         TEXT NOT NULL,
        user_id    INTEGER NOT NULL REFERENCES users(id),
        name       TEXT NOT NULL DEFAULT '',
        company    TEXT NOT NULL DEFAULT '',
        phone      TEXT NOT NULL DEFAULT '',
        email      TEXT NOT NULL DEFAULT '',
        address    TEXT NOT NULL DEFAULT '',
        notes      TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (id, user_id)
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS jobs (
        id         TEXT NOT NULL,
        client_id  TEXT NOT NULL,
        user_id    INTEGER NOT NULL REFERENCES users(id),
        name       TEXT NOT NULL DEFAULT '',
        address    TEXT NOT NULL DEFAULT '',
        job_number TEXT NOT NULL DEFAULT '',
        quotes     JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (id, user_id)
      )
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_clients_user ON clients(user_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_jobs_user ON jobs(user_id)`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_jobs_client ON jobs(client_id, user_id)`);

    // Table for hosted interactive quote HTML links
    await db.query(`
      CREATE TABLE IF NOT EXISTS quote_links (
        token      TEXT PRIMARY KEY,
        user_id    INTEGER REFERENCES users(id),
        html       TEXT NOT NULL,
        ref        TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '90 days'
      )
    `);

    // 2. Migrate any proquote_clients blobs from the settings table
    const { rows } = await db.query(
      `SELECT s.value, s.user_id FROM settings s
       WHERE s.key = 'proquote_clients' AND s.user_id IS NOT NULL AND s.value IS NOT NULL AND s.value != '[]'`
    );
    for (const row of rows) {
      // Skip if this user already has clients (already migrated)
      const { rows: existing } = await db.query(
        'SELECT 1 FROM clients WHERE user_id = $1 LIMIT 1', [row.user_id]
      );
      if (existing.length) continue;

      let clients;
      try { clients = JSON.parse(row.value); } catch (e) { continue; }
      if (!Array.isArray(clients) || !clients.length) continue;

      for (const c of clients) {
        const cid = String(c.id || Date.now());
        await db.query(
          `INSERT INTO clients (id, user_id, name, company, phone, email, address, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,
          [cid, row.user_id, c.name||'', c.company||'', c.phone||'', c.email||'', c.address||'', c.notes||'']
        );
        for (const j of (c.jobs || [])) {
          const jid = String(j.id || (Date.now() + Math.random()));
          await db.query(
            `INSERT INTO jobs (id, client_id, user_id, name, address, job_number, quotes)
             VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
            [jid, cid, row.user_id, j.name||'', j.address||'', j.jobNumber||j.job_number||'', JSON.stringify(j.quotes||[])]
          );
        }
      }
      console.log(`[ProQuote] Clients migration: migrated ${clients.length} clients for user ${row.user_id}`);
    }
  } catch (err) {
    console.error('[ProQuote] migrateClients failed:', err);
  }
}

// ── Backfill clients/jobs from quotes table ───────────────────────────────────
// Scans every quote that has a clientName and creates the corresponding client
// and job records if they don't already exist. Safe to run on every startup —
// it only INSERTs missing rows and merges missing quote snapshots.
async function migrateQuotesToClients() {
  try {
    const { rows: allRows } = await db.query(
      'SELECT user_id, data FROM quotes WHERE user_id IS NOT NULL AND data IS NOT NULL'
    );
    if (!allRows.length) return;

    // Group parsed quotes by user_id
    const byUser = {};
    for (const row of allRows) {
      let data;
      try { data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data; } catch { continue; }
      const f = data.fields || data;
      const clientName = (f.clientName || '').trim();
      if (!clientName) continue;
      if (!byUser[row.user_id]) byUser[row.user_id] = [];
      byUser[row.user_id].push({ data, f });
    }

    let counter = 0;
    const nextId = () => String(Date.now() + (++counter));

    for (const [userId, quotes] of Object.entries(byUser)) {
      // Load existing clients for this user (keyed by lowercase name)
      const { rows: existingClients } = await db.query(
        'SELECT id, name FROM clients WHERE user_id = $1', [userId]
      );
      const clientIdByName = new Map(existingClients.map(c => [c.name.toLowerCase(), c.id]));

      // Group quotes by clientName → jobName
      const clientMap = new Map();
      for (const { data, f } of quotes) {
        const clientName = (f.clientName || '').trim();
        const jobName    = (f.jobName    || '').trim() || 'General';
        if (!clientName) continue;
        if (!clientMap.has(clientName)) clientMap.set(clientName, new Map());
        if (!clientMap.get(clientName).has(jobName)) clientMap.get(clientName).set(jobName, []);
        clientMap.get(clientName).get(jobName).push({ data, f });
      }

      for (const [clientName, jobMap] of clientMap) {
        // Create client if not present
        let clientId = clientIdByName.get(clientName.toLowerCase());
        if (!clientId) {
          clientId = nextId();
          const firstF = [...jobMap.values()][0][0].f;
          await db.query(
            `INSERT INTO clients (id, user_id, name, phone, email, address, company, notes)
             VALUES ($1,$2,$3,$4,$5,$6,'','') ON CONFLICT DO NOTHING`,
            [clientId, userId, clientName, firstF.clientPhone||'', firstF.clientEmail||'', firstF.siteAddr||'']
          );
          clientIdByName.set(clientName.toLowerCase(), clientId);
        }

        // Load existing jobs for this client
        const { rows: existingJobs } = await db.query(
          'SELECT id, name, quotes FROM jobs WHERE client_id = $1 AND user_id = $2',
          [clientId, userId]
        );
        const jobByName = new Map(existingJobs.map(j => [j.name.toLowerCase(), j]));

        for (const [jobName, jobQuotes] of jobMap) {
          // Build lightweight quote snapshots (no sections — those live in the quotes table)
          const snapshots = jobQuotes
            .map(({ data, f }) => ({
              quoteRef:    f.quoteRef    || '',
              quoteDate:   f.quoteDate   || '',
              _publishedAt: data._publishedAt || null,
              _emailSentAt: data._emailSentAt || null,
              _approvedAt:  data._approvedAt  || null,
              _createdAt:   data._createdAt   || null,
            }))
            .filter(s => s.quoteRef);

          const existingJob = jobByName.get(jobName.toLowerCase());
          if (!existingJob) {
            const firstF = jobQuotes[0].f;
            await db.query(
              `INSERT INTO jobs (id, client_id, user_id, name, address, job_number, quotes)
               VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
              [nextId(), clientId, userId, jobName,
               firstF.siteAddr||'', firstF.jobNumber||'', JSON.stringify(snapshots)]
            );
          } else {
            // Merge in quote snapshots that aren't already stored
            let stored = [];
            try { stored = typeof existingJob.quotes === 'string' ? JSON.parse(existingJob.quotes) : (existingJob.quotes || []); } catch {}
            const storedRefs = new Set(stored.map(s => s.quoteRef));
            const toAdd = snapshots.filter(s => s.quoteRef && !storedRefs.has(s.quoteRef));
            if (toAdd.length) {
              await db.query('UPDATE jobs SET quotes = $1::jsonb WHERE id = $2',
                [JSON.stringify([...stored, ...toAdd]), existingJob.id]);
            }
          }
        }
      }
    }
    console.log('[ProQuote] migrateQuotesToClients: done.');
  } catch (err) {
    console.error('[ProQuote] migrateQuotesToClients failed:', err);
  }
}

async function migratePricelists() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS pricelists (
        id         TEXT NOT NULL,
        user_id    INTEGER NOT NULL REFERENCES users(id),
        name       TEXT NOT NULL DEFAULT '',
        is_adonai  BOOLEAN NOT NULL DEFAULT FALSE,
        meta       JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (id, user_id)
      )
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS pricelist_items (
        id           BIGSERIAL PRIMARY KEY,
        pricelist_id TEXT NOT NULL,
        user_id      INTEGER NOT NULL REFERENCES users(id),
        sort_order   INTEGER NOT NULL DEFAULT 0,
        code         TEXT NOT NULL DEFAULT '',
        d1           TEXT NOT NULL DEFAULT '',
        d2           TEXT NOT NULL DEFAULT '',
        category     TEXT NOT NULL DEFAULT '',
        unit         TEXT NOT NULL DEFAULT 'EA',
        price        NUMERIC(14,6) NOT NULL DEFAULT 0,
        extras       JSONB NOT NULL DEFAULT '{}'
      )
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_pl_items ON pricelist_items(pricelist_id, user_id)`);
    console.log('[ProQuote] migratePricelists: done.');
  } catch (err) {
    console.error('[ProQuote] migratePricelists failed:', err);
  }
}

// Run migration in the background after server is up
migrateAuth().then(() => seedUser()).then(() => migrateClients()).then(() => migrateQuotesToClients()).then(() => migratePricelists()).catch(err => {
  console.error('[ProQuote] Startup migration failed:', err);
});
