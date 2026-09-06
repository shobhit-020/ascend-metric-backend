# Ascend Metric Backend — Setup & Deployment Guide

This backend gives your website: signup, login, profile, and Razorpay payments.
It's built with **Node.js + Express + SQLite** — lightweight, no separate database server needed.

---

## 1. What's inside

```
server/
  server.js          → main app
  db.js              → SQLite database (auto-creates ascendmetric.db)
  routes/auth.js      → /api/auth/signup, /api/auth/login
  routes/profile.js   → /api/profile/me (GET + PUT)
  routes/payment.js   → /api/payment/create-order, /api/payment/verify
  middleware/auth.js  → checks login token on protected routes
  .env.example        → copy to .env and fill in real values
```

## 2. Run it locally (to test before deploying)

You need **Node.js** installed (v18+) on your computer.

```bash
cd server
npm install
cp .env.example .env
```

Now open `.env` and fill in:
- `JWT_SECRET` — any long random string (run `openssl rand -hex 32` to generate one, or just type 40 random characters)
- `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` — get these from your Razorpay Dashboard → **Settings → API Keys**. Start with **Test Mode** keys (they start with `rzp_test_`) so you don't move real money while testing.

Then start the server:

```bash
npm start
```

It will run at `http://localhost:4000`.

## 3. Connect the frontend to it

Open `index.html`, `signup.html`, `login.html`, `dashboard.html` in a code editor and add this **one line** right before the closing `</head>` tag of each file:

```html
<script>window.ASCEND_API_BASE = 'http://localhost:4000';</script>
```

While testing locally, open the website with a local server (not by double-clicking the file) — e.g. using VS Code's "Live Server" extension — otherwise the browser blocks the API calls.

## 4. Set up Gmail OTP (email verification on signup)

Signup now requires a 6-digit code sent to the user's email before an account is created. To send that email, you need a **Gmail App Password** (not your normal Gmail password):

1. Go to your Google Account → **Security** → turn on **2-Step Verification** (required first).
2. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
3. Generate a new App Password (name it "Ascend Metric").
4. Copy the 16-character password into your `.env` as `GMAIL_APP_PASSWORD`.
5. Set `GMAIL_USER=ascendmetric78@gmail.com` (or whichever Gmail account should send the OTPs).

Test it locally — sign up on the site with a real email and check that the OTP arrives within a few seconds.

## 5. Get real Razorpay keys (before going live)

1. Sign up at [razorpay.com](https://razorpay.com) with your business details.
2. Complete KYC (needed before you can accept real payments — test mode works without it).
3. Go to **Settings → API Keys** → generate **Live** keys once KYC is approved.
4. Replace the test keys in your `.env` with the live ones.

## 6. Deploy the backend so it's live 24/7

This backend needs to run somewhere that stays on — pick one:

**Option A — Render.com (easiest, has a free tier)**
1. Push this `server/` folder to a GitHub repo.
2. On Render.com → New → Web Service → connect your repo.
3. Build command: `npm install`  |  Start command: `npm start`
4. Add your `.env` values under Render's "Environment" tab (don't upload the `.env` file itself).
5. Render gives you a live URL like `https://ascendmetric-api.onrender.com`.

**Option B — Railway.app** — same idea as Render, also has a simple free/low-cost tier.

Once deployed, update the `window.ASCEND_API_BASE` line in your HTML files to point to that live URL instead of `localhost:4000`.

## 7. Deploy the frontend (website itself)

Your `index.html` + other pages can go on **Netlify**, **Vercel**, or **GitHub Pages** — just drag-and-drop the whole website folder (excluding `server/`) onto Netlify for the fastest option.

## 8. Important security notes

- **Never** commit your real `.env` file to GitHub — it has your Razorpay secret key.
- The SQLite database (`ascendmetric.db`) stores customer names, emails, hashed passwords, and payment records. Back it up periodically once live — on Render's free tier, the filesystem can reset on redeploy, so for serious production use, consider upgrading to a persistent database like PostgreSQL later.
- Passwords are hashed with bcrypt before storing — plain passwords are never saved.
- Once you have real customers, review Razorpay's webhook feature to catch payments even if a user closes the browser before the "verify" step completes.
