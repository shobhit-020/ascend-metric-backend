const nodemailer = require('nodemailer');

// Uses Gmail SMTP with an App Password (NOT your regular Gmail password).
// See server/README.md → "Setting up Gmail OTP" for how to generate one.
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

async function sendOtpEmail(toEmail, otp) {
  await transporter.sendMail({
    from: `"Ascend Metric" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: `Your Ascend Metric verification code: ${otp}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:420px;margin:0 auto;padding:24px;">
        <h2 style="color:#0e6b52;">Verify your email</h2>
        <p>Your one-time verification code is:</p>
        <div style="font-size:32px;font-weight:700;letter-spacing:6px;background:#f4f5f6;padding:16px;text-align:center;border-radius:6px;">${otp}</div>
        <p style="color:#565d66;font-size:13px;margin-top:16px;">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
      </div>
    `,
  });
}

module.exports = { sendOtpEmail };
