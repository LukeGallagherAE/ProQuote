const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/storage — return all key-value pairs as a flat object
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT key, value FROM settings');
    const out = {};
    rows.forEach(r => { out[r.key] = r.value; });
    res.json(out);
  } catch (err) {
    console.error('GET /api/storage:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// PUT /api/storage — upsert all key-value pairs from request body
// Body: { "proquote_profile": "...", "proquote_clients": "[...]", ... }
router.put('/', async (req, res) => {
  const entries = Object.entries(req.body || {});
  if (!entries.length) return res.json({ ok: true });

  try {
    // Batch upsert using unnest
    const keys = entries.map(([k]) => k);
    const vals = entries.map(([, v]) => (typeof v === 'string' ? v : JSON.stringify(v)));

    await db.query(
      `INSERT INTO settings (key, value, updated_at)
       SELECT unnest($1::text[]), unnest($2::text[]), NOW()
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [keys, vals]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/storage:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /api/storage/:key — remove a single key
router.delete('/:key', async (req, res) => {
  try {
    await db.query('DELETE FROM settings WHERE key = $1', [req.params.key]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/storage/:key:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
