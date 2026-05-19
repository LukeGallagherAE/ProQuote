const express    = require('express');
const router     = express.Router();
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const db         = require('../db');
const requireAuth = require('../middleware/requireAuth');

const JWT_SECRET  = process.env.JWT_SECRET || 'proquote-secret-change-me';
const JWT_EXPIRES = '90d';

function makeToken(user) {
  return jwt.sign(
    { userId: user.id, username: user.username, biz: user.biz_name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

// GET /api/auth/status — public, tells the frontend whether an account exists
router.get('/status', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT COUNT(*)::int AS count FROM users');
    res.json({ hasUsers: rows[0].count > 0 });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  try {
    const { rows } = await db.query(
      'SELECT id, username, password_hash, biz_name FROM users WHERE username = $1',
      [username]
    );
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ token: makeToken(user) });
  } catch (err) {
    console.error('POST /api/auth/login:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/auth/register — open registration
router.post('/register', async (req, res) => {
  const { username, password, biz } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }
  try {
    // Check username not already taken
    const { rows: taken } = await db.query('SELECT id FROM users WHERE username = $1', [username]);
    if (taken.length) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const hash = await bcrypt.hash(password, 12);
    const { rows } = await db.query(
      'INSERT INTO users (username, password_hash, biz_name) VALUES ($1, $2, $3) RETURNING id, username, biz_name',
      [username, hash, biz || '']
    );
    res.json({ token: makeToken(rows[0]) });
  } catch (err) {
    console.error('POST /api/auth/register:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }
  if (newPassword.length < 4) {
    return res.status(400).json({ error: 'New password must be at least 4 characters' });
  }
  try {
    const { rows } = await db.query(
      'SELECT id, password_hash FROM users WHERE id = $1',
      [req.user.userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const ok = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });
    const hash = await bcrypt.hash(newPassword, 12);
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/auth/change-password:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ username: req.user.username, biz: req.user.biz });
});

module.exports = router;
