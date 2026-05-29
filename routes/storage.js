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

    // Schema-agnostic upsert: UPDATE first, INSERT on miss.
    // Works regardless of whether the settings table has a PK on (key)
    // or a composite unique constraint on (key, user_id).
    for (let i = 0; i < keys.length; i++) {
      const { rowCount } = await db.query(
        `UPDATE settings SET value = $1, user_id = $2, updated_at = NOW()
         WHERE key = $3 AND (user_id = $2 OR user_id IS NULL)`,
        [vals[i], userId, keys[i]]
      );
      if (rowCount === 0) {
        try {
          await db.query(
            `INSERT INTO settings (key, value, user_id, updated_at) VALUES ($1, $2, $3, NOW())`,
            [keys[i], vals[i], userId]
          );
        } catch (insertErr) {
          // Another row with this key already exists (race or schema constraint) — force update
          await db.query(
            `UPDATE settings SET value = $1, user_id = $2, updated_at = NOW() WHERE key = $3`,
            [vals[i], userId, keys[i]]
          );
        }
      }
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
