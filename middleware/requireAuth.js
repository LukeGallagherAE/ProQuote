const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'proquote-secret-change-me';

module.exports = function requireAuth(req, res, next) {
  const token = (req.headers['authorization'] || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorised' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    res.status(401).json({ error: 'Token invalid or expired' });
  }
};
