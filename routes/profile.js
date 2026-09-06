const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// ---- GET current user's profile ----
router.get('/me', requireAuth, (req, res) => {
  const user = db
    .prepare('SELECT id, name, email, phone, address, website, plan, plan_expiry, created_at FROM users WHERE id = ?')
    .get(req.userId);

  if (!user) return res.status(404).json({ error: 'User not found.' });

  const payments = db
    .prepare('SELECT plan, amount_inr, status, created_at FROM payments WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.userId);

  res.json({ user, payments });
});

// ---- UPDATE profile (name, phone, address, website) ----
router.put('/me', requireAuth, (req, res) => {
  const { name, phone, address, website } = req.body;

  const current = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!current) return res.status(404).json({ error: 'User not found.' });

  db.prepare('UPDATE users SET name = ?, phone = ?, address = ?, website = ? WHERE id = ?').run(
    name || current.name,
    phone !== undefined ? phone : current.phone,
    address !== undefined ? address : current.address,
    website !== undefined ? website : current.website,
    req.userId
  );

  const updated = db
    .prepare('SELECT id, name, email, phone, address, website, plan FROM users WHERE id = ?')
    .get(req.userId);

  res.json({ user: updated });
});

module.exports = router;
