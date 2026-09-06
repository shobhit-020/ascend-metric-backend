const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const { sendOtpEmail } = require('../mailer');

const router = express.Router();

// ---- SEND OTP (step 1 of signup) ----
router.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const otp = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

  db.prepare('INSERT INTO otps (email, code, expires_at) VALUES (?, ?, ?)').run(
    email.toLowerCase(),
    otp,
    expiresAt
  );

  try {
    await sendOtpEmail(email, otp);
    res.json({ success: true, message: 'OTP sent to your email.' });
  } catch (err) {
    console.error('Failed to send OTP email:', err);
    res.status(500).json({ error: 'Could not send verification email. Check GMAIL_USER / GMAIL_APP_PASSWORD in server .env.' });
  }
});

// ---- VERIFY OTP (step 2 of signup) ----
router.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required.' });

  const record = db
    .prepare('SELECT * FROM otps WHERE email = ? AND code = ? ORDER BY id DESC LIMIT 1')
    .get(email.toLowerCase(), otp);

  if (!record) return res.status(400).json({ error: 'Incorrect OTP.' });
  if (new Date(record.expires_at) < new Date()) {
    return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
  }

  db.prepare('UPDATE otps SET verified = 1 WHERE id = ?').run(record.id);
  res.json({ success: true, message: 'Email verified.' });
});

// ---- SIGN UP (step 3 — only allowed after OTP is verified) ----
router.post('/signup', async (req, res) => {
  const { name, email, password, phone } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const verifiedOtp = db
    .prepare('SELECT * FROM otps WHERE email = ? AND verified = 1 ORDER BY id DESC LIMIT 1')
    .get(email.toLowerCase());

  if (!verifiedOtp) {
    return res.status(403).json({ error: 'Please verify your email with the OTP before signing up.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const result = db
    .prepare('INSERT INTO users (name, email, password_hash, phone) VALUES (?, ?, ?, ?)')
    .run(name, email.toLowerCase(), passwordHash, phone || null);

  const token = jwt.sign({ userId: result.lastInsertRowid }, process.env.JWT_SECRET, { expiresIn: '7d' });

  res.status(201).json({
    token,
    user: { id: result.lastInsertRowid, name, email: email.toLowerCase(), phone: phone || null, plan: 'none' }
  });
});

// ---- LOGIN ----
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
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone, website: user.website, plan: user.plan }
  });
});

module.exports = router;
