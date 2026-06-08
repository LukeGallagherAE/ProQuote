const express     = require('express');
const router      = express.Router();
const db          = require('../db');
const requireAuth = require('../middleware/requireAuth');

router.use(requireAuth);

// GET /api/pricelists — return all pricelists for this user with their items
router.get('/', async (req, res) => {
  try {
    const { rows: lists } = await db.query(
      `SELECT id, name, is_adonai, meta, created_at, updated_at
       FROM pricelists WHERE user_id = $1 ORDER BY created_at ASC`,
      [req.user.userId]
    );
    if (!lists.length) return res.json([]);

    const { rows: items } = await db.query(
      `SELECT pricelist_id, sort_order, code, d1, d2, category, unit, price, extras
       FROM pricelist_items WHERE user_id = $1 ORDER BY pricelist_id, sort_order`,
      [req.user.userId]
    );

    // Group items by pricelist_id
    const itemsByList = {};
    for (const item of items) {
      if (!itemsByList[item.pricelist_id]) itemsByList[item.pricelist_id] = [];
      itemsByList[item.pricelist_id].push({
        c:      item.code,
        d1:     item.d1,
        d2:     item.d2,
        cat:    item.category,
        u:      item.unit,
        p:      parseFloat(item.price),
        extras: item.extras || {},
      });
    }

    res.json(lists.map(l => ({
      id:        l.id,
      name:      l.name,
      is_adonai: l.is_adonai,
      meta:      l.meta || {},
      items:     itemsByList[l.id] || [],
    })));
  } catch (err) {
    console.error('GET /api/pricelists:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// PUT /api/pricelists/:id — full upsert (pricelist row + atomic replace of items)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name = '', is_adonai = false, meta = {}, items = [] } = req.body;
  const userId = req.user.userId;

  try {
    await db.query('BEGIN');

    // Upsert the pricelist row
    await db.query(
      `INSERT INTO pricelists (id, user_id, name, is_adonai, meta, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (id, user_id) DO UPDATE SET
         name       = EXCLUDED.name,
         is_adonai  = EXCLUDED.is_adonai,
         meta       = EXCLUDED.meta,
         updated_at = NOW()`,
      [id, userId, name, !!is_adonai, JSON.stringify(meta)]
    );

    // Delete all existing items for this pricelist+user
    await db.query(
      'DELETE FROM pricelist_items WHERE pricelist_id = $1 AND user_id = $2',
      [id, userId]
    );

    // Bulk insert new items in chunks of 500 to avoid pg parameter limits
    if (Array.isArray(items) && items.length) {
      const CHUNK = 500;
      for (let start = 0; start < items.length; start += CHUNK) {
        const chunk = items.slice(start, start + CHUNK);
        const placeholders = [];
        const params = [];
        let p = 1;
        for (let i = 0; i < chunk.length; i++) {
          const item = chunk[i];
          const extras = {};
          if (item._custom   !== undefined) extras._custom   = item._custom;
          if (item._packQty  !== undefined) extras._packQty  = item._packQty;
          if (item._rawPrice !== undefined) extras._rawPrice = item._rawPrice;
          if (item._reviewed !== undefined) extras._reviewed = item._reviewed;
          if (item.extras && typeof item.extras === 'object') Object.assign(extras, item.extras);
          placeholders.push(`($${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++})`);
          params.push(id, userId, start + i, item.c||'', item.d1||'', item.d2||'', item.cat||'', item.u||'EA', parseFloat(item.p)||0, JSON.stringify(extras));
        }
        await db.query(
          `INSERT INTO pricelist_items (pricelist_id,user_id,sort_order,code,d1,d2,category,unit,price,extras) VALUES ${placeholders.join(',')}`,
          params
        );
      }
    }

    await db.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    console.error('PUT /api/pricelists/:id:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// PATCH /api/pricelists/:id — rename only
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (typeof name !== 'string') return res.status(400).json({ error: 'name required' });
  try {
    await db.query(
      'UPDATE pricelists SET name = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3',
      [name, id, req.user.userId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/pricelists/:id:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /api/pricelists/:id — delete pricelist and all its items
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;
  try {
    await db.query('BEGIN');
    await db.query('DELETE FROM pricelist_items WHERE pricelist_id = $1 AND user_id = $2', [id, userId]);
    await db.query('DELETE FROM pricelists WHERE id = $1 AND user_id = $2', [id, userId]);
    await db.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    console.error('DELETE /api/pricelists/:id:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
