const express     = require('express');
const router      = express.Router();
const db          = require('../db');
const requireAuth = require('../middleware/requireAuth');
const { getConfig, saveConfig, getBalances, sendDebtSummaryEmail } = require('../lib/debtEmail');

router.use(requireAuth);

function newId() {
  return String(Date.now()) + Math.random().toString(36).slice(2, 7);
}

// GET /api/wholesalers — list wholesalers with their current unpaid balance
router.get('/', async (req, res) => {
  try {
    const balances = await getBalances(req.user.userId);
    const byId = {};
    balances.forEach(b => { byId[b.id] = b; });
    const { rows } = await db.query(
      'SELECT id, name, notes, created_at FROM wholesalers WHERE user_id=$1 ORDER BY name',
      [req.user.userId]
    );
    res.json(rows.map(w => ({
      ...w,
      balance:        byId[w.id] ? byId[w.id].balance : 0,
      lastChargeDate: byId[w.id] ? byId[w.id].lastChargeDate : null,
    })));
  } catch (err) {
    console.error('GET /api/wholesalers:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/wholesalers — create a wholesaler account
router.post('/', async (req, res) => {
  const { name, notes } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  const id = newId();
  try {
    await db.query(
      'INSERT INTO wholesalers (id, user_id, name, notes) VALUES ($1,$2,$3,$4)',
      [id, req.user.userId, name.trim(), notes || '']
    );
    res.json({ id, name: name.trim(), notes: notes || '', balance: 0, lastChargeDate: null });
  } catch (err) {
    console.error('POST /api/wholesalers:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/wholesalers/debt-email-config — current monthly-email settings
router.get('/debt-email-config', async (req, res) => {
  try {
    res.json(await getConfig(req.user.userId));
  } catch (err) {
    console.error('GET /api/wholesalers/debt-email-config:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// PUT /api/wholesalers/debt-email-config — update monthly-email settings
router.put('/debt-email-config', async (req, res) => {
  const { enabled, day, recipient } = req.body || {};
  try {
    const existing = await getConfig(req.user.userId);
    const config = {
      ...existing,
      enabled:   !!enabled,
      day:       Math.min(28, Math.max(1, parseInt(day, 10) || 1)),
      recipient: (recipient || '').trim() || existing.recipient,
    };
    await saveConfig(req.user.userId, config);
    res.json(config);
  } catch (err) {
    console.error('PUT /api/wholesalers/debt-email-config:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/wholesalers/send-summary — send the debt summary email right now
router.post('/send-summary', async (req, res) => {
  try {
    const result = await sendDebtSummaryEmail(req.user.userId);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('POST /api/wholesalers/send-summary:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/wholesalers/:id — update a wholesaler's name/notes
router.put('/:id', async (req, res) => {
  const { name, notes } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  try {
    const { rowCount } = await db.query(
      'UPDATE wholesalers SET name=$1, notes=$2, updated_at=NOW() WHERE id=$3 AND user_id=$4',
      [name.trim(), notes || '', req.params.id, req.user.userId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/wholesalers/:id:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /api/wholesalers/:id — delete a wholesaler and its charge history
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM wholesaler_charges WHERE wholesaler_id=$1 AND user_id=$2', [req.params.id, req.user.userId]);
    await db.query('DELETE FROM wholesalers WHERE id=$1 AND user_id=$2', [req.params.id, req.user.userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/wholesalers/:id:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/wholesalers/:id/charges — charge history for one wholesaler
router.get('/:id/charges', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, amount, description, charge_date, paid, paid_at, created_at
       FROM wholesaler_charges WHERE wholesaler_id=$1 AND user_id=$2
       ORDER BY charge_date DESC, created_at DESC`,
      [req.params.id, req.user.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /api/wholesalers/:id/charges:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/wholesalers/:id/charges — log a new charge against a wholesaler
router.post('/:id/charges', async (req, res) => {
  const { amount, description, charge_date } = req.body || {};
  const amt = Number(amount);
  if (!amt || amt <= 0) return res.status(400).json({ error: 'A positive amount is required' });
  try {
    const { rows: whCheck } = await db.query('SELECT 1 FROM wholesalers WHERE id=$1 AND user_id=$2', [req.params.id, req.user.userId]);
    if (!whCheck.length) return res.status(404).json({ error: 'Wholesaler not found' });
    const id = newId();
    await db.query(
      `INSERT INTO wholesaler_charges (id, wholesaler_id, user_id, amount, description, charge_date)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6, CURRENT_DATE))`,
      [id, req.params.id, req.user.userId, amt, description || '', charge_date || null]
    );
    res.json({ ok: true, id });
  } catch (err) {
    console.error('POST /api/wholesalers/:id/charges:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/wholesalers/:id/mark-paid — zero the current balance, starting a new cycle
router.post('/:id/mark-paid', async (req, res) => {
  try {
    await db.query(
      'UPDATE wholesaler_charges SET paid=TRUE, paid_at=NOW() WHERE wholesaler_id=$1 AND user_id=$2 AND paid=FALSE',
      [req.params.id, req.user.userId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/wholesalers/:id/mark-paid:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /api/wholesalers/charges/:chargeId — remove/correct a single charge
router.delete('/charges/:chargeId', async (req, res) => {
  try {
    await db.query('DELETE FROM wholesaler_charges WHERE id=$1 AND user_id=$2', [req.params.chargeId, req.user.userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/wholesalers/charges/:chargeId:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
