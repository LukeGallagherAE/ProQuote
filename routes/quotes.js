const express     = require('express');
const router      = express.Router();
const db          = require('../db');
const requireAuth = require('../middleware/requireAuth');

// All quotes routes require authentication
router.use(requireAuth);

// GET /api/quotes — return all quotes for the authenticated user
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, name, data, created_at, updated_at FROM quotes WHERE user_id = $1 ORDER BY created_at ASC',
      [req.user.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /api/quotes:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/quotes/:id — return a single quote
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, name, data, created_at, updated_at FROM quotes WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /api/quotes/:id:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// PUT /api/quotes/:id — upsert a quote (create or update)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  const name = data?.fields?.quoteRef || data?.name || 'Untitled';

  try {
    await db.query(
      `INSERT INTO quotes (id, name, data, user_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE
         SET name = EXCLUDED.name, data = EXCLUDED.data,
             user_id = EXCLUDED.user_id, updated_at = NOW()`,
      [id, name, JSON.stringify(data), req.user.userId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/quotes/:id:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /api/quotes/:id — delete a quote
router.delete('/:id', async (req, res) => {
  try {
    await db.query(
      'DELETE FROM quotes WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/quotes/:id:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
