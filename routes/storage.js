const express     = require('express');
const router      = express.Router();
const db          = require('../db');
const requireAuth = require('../middleware/requireAuth');

// All storage routes require authentication
router.use(requireAuth);

// GET /api/storage — return all key-value pairs for the authenticated user
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT key, value FROM settings WHERE user_id = $1',
      [req.user.userId]
    );
    const out = {};
    rows.forEach(r => { out[r.key] = r.value; });
    res.json(out);
  } catch (err) {
    console.error('GET /api/storage:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// PUT /api/storage — upsert all key-value pairs from request body
router.put('/', async (req, res) => {
  const entries = Object.entries(req.body || {});
  if (!entries.length) return res.json({ ok: true });

  try {
    const keys   = entries.map(([k]) => k);
    const vals   = entries.map(([, v]) => (typeof v === 'string' ? v : JSON.stringify(v)));
    const userId = req.user.userId;

    // Batch upsert — conflict on key (original PK). user_id is also updated
    // so rows are correctly owned after a schema migration.
    for (let i = 0; i < keys.length; i++) {
      await db.query(
        `INSERT INTO settings (key, value, user_id, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (key) DO UPDATE
           SET value = EXCLUDED.value, user_id = EXCLUDED.user_id, updated_at = NOW()`,
        [keys[i], vals[i], userId]
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/storage:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /api/storage/:key — remove a single key for the authenticated user
router.delete('/:key', async (req, res) => {
  try {
    await db.query(
      'DELETE FROM settings WHERE key = $1 AND user_id = $2',
      [req.params.key, req.user.userId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/storage/:key:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
