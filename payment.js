const express = require('express');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Plan prices in INR (paise = amount * 100 for Razorpay)
const PLAN_PRICES = {
  starter: 25000,
  growth: 55000,
  // enterprise is "custom" — handle separately via manual quote, not this endpoint
};

// ---- CREATE an order (called when user clicks "Pay" on a plan) ----
router.post('/create-order', requireAuth, async (req, res) => {
  const { plan } = req.body;

  const amount = PLAN_PRICES[plan];
  if (!amount) {
    return res.status(400).json({ error: 'Invalid plan. Use "starter" or "growth".' });
  }

  try {
    const order = await razorpay.orders.create({
      amount: amount * 100, // Razorpay expects paise
      currency: 'INR',
      receipt: `receipt_user${req.userId}_${Date.now()}`,
    });

    db.prepare(
      'INSERT INTO payments (user_id, plan, amount_inr, razorpay_order_id, status) VALUES (?, ?, ?, ?, ?)'
    ).run(req.userId, plan, amount, order.id, 'created');

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID, // safe to expose — this is the public key
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create payment order.' });
  }
});

// ---- VERIFY payment (called after Razorpay checkout completes on the frontend) ----
router.post('/verify', requireAuth, (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing payment verification fields.' });
  }

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  const isValid = expectedSignature === razorpay_signature;

  const payment = db.prepare('SELECT * FROM payments WHERE razorpay_order_id = ?').get(razorpay_order_id);
  if (!payment) return res.status(404).json({ error: 'Order not found.' });

  if (!isValid) {
    db.prepare('UPDATE payments SET status = ? WHERE razorpay_order_id = ?').run('failed', razorpay_order_id);
    return res.status(400).json({ error: 'Payment verification failed.' });
  }

  db.prepare(
    'UPDATE payments SET status = ?, razorpay_payment_id = ?, razorpay_signature = ? WHERE razorpay_order_id = ?'
  ).run('paid', razorpay_payment_id, razorpay_signature, razorpay_order_id);

  db.prepare('UPDATE users SET plan = ? WHERE id = ?').run(payment.plan, req.userId);

  res.json({ success: true, plan: payment.plan });
});

module.exports = router;
