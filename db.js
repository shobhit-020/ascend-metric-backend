const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'ascendmetric.db'));

db.pragma('journal_mode = WAL');

// ---- Schema ----
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    website TEXT,
    plan TEXT DEFAULT 'none',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    plan TEXT NOT NULL,
    amount_inr INTEGER NOT NULL,
    razorpay_order_id TEXT NOT NULL,
    razorpay_payment_id TEXT,
    razorpay_signature TEXT,
    status TEXT DEFAULT 'created',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS otps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    verified INTEGER DEFAULT 0,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Safe migration: adds new columns if this database already existed
// before these fields were introduced (won't error out if already there).
try {
  db.exec('ALTER TABLE users ADD COLUMN address TEXT');
} catch (err) {
  // Column already exists — nothing to do.
}
try {
  db.exec('ALTER TABLE users ADD COLUMN plan_expiry TEXT');
} catch (err) {
  // Column already exists — nothing to do.
}

module.exports = db;
