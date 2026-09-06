const express = require('express');
const db = require('../db');

const router = express.Router();

// Simple password-based protection for the admin panel.
// Set ADMIN_SECRET in your .env — this is NOT the same as a user login,
// it's a single shared password only you (the business owner) know.
function requireAdmin(req, res, next) {
  const providedSecret = req.headers['x-admin-secret'];
  if (!process.env.ADMIN_SECRET) {
    return res.status(500).json({ error: 'ADMIN_SECRET is not set on the server.' });
  }
  if (providedSecret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Incorrect admin password.' });
  }
  next();
}

// ---- GET all customers, with their payment history and subscription status ----
router.get('/users', requireAdmin, (req, res) => {
  const users = db
    .prepare('SELECT id, name, email, phone, address, website, plan, plan_expiry, created_at FROM users ORDER BY created_at DESC')
    .all();

  const payments = db.prepare('SELECT * FROM payments ORDER BY created_at DESC').all();

  const usersWithPayments = users.map((user) => {
    let daysRemaining = null;
    let subscriptionStatus = 'No active plan';

    if (user.plan_expiry) {
      const msRemaining = new Date(user.plan_expiry).getTime() - Date.now();
      daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));
      subscriptionStatus = daysRemaining > 0 ? `${daysRemaining} day(s) left` : 'Expired';
    }

    return {
      ...user,
      daysRemaining,
      subscriptionStatus,
      payments: payments.filter((p) => p.user_id === user.id),
    };
  });

  const totals = {
    totalCustomers: users.length,
    totalPaidRevenue: payments
      .filter((p) => p.status === 'paid')
      .reduce((sum, p) => sum + p.amount_inr, 0),
    activeSubscriptions: usersWithPayments.filter((u) => u.daysRemaining > 0).length,
  };

  res.json({ users: usersWithPayments, totals });
});

module.exports = router;
