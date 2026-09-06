const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();

// ---- SIGN UP (single step — no OTP, account created immediately) ----
router.post('/signup', async (req, res) => {
  const { name, email, password, phone, address } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const result = db
    .prepare('INSERT INTO users (name, email, password_hash, phone, address) VALUES (?, ?, ?, ?, ?)')
    .run(name, email.toLowerCase(), passwordHash, phone || null, address || null);

  const token = jwt.sign({ userId: result.lastInsertRowid }, process.env.JWT_SECRET, { expiresIn: '7d' });

  res.status(201).json({
    token,
    user: { id: result.lastInsertRowid, name, email: email.toLowerCase(), phone: phone || null, address: address || null, plan: 'none' }
  });
});

// ---- LOGIN (email + password) ----
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone, address: user.address, website: user.website, plan: user.plan }
  });
});

module.exports = router;
