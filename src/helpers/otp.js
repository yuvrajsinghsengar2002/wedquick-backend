const axios = require('axios');
const db    = require('../../config/db');

// ── Generate 6-digit OTP ──────────────────────────────────────
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── Send OTP via MSG91 ────────────────────────────────────────
async function sendOTP(phone, otp) {
  // In dev mode, just log
  if (process.env.NODE_ENV !== 'production') {
    console.log(`📱  [DEV] OTP for ${phone}: ${otp}`);
    return true;
  }
  try {
    await axios.post('https://control.msg91.com/api/v5/otp', {
      template_id: process.env.MSG91_TEMPLATE_ID,
      mobile:      `91${phone}`,
      otp,
    }, {
      headers: { authkey: process.env.MSG91_AUTH_KEY, 'Content-Type': 'application/json' },
    });
    return true;
  } catch (err) {
    console.error('MSG91 error:', err.response?.data || err.message);
    return false;
  }
}

// ── Store OTP in DB ───────────────────────────────────────────
async function storeOTP(phone, otp) {
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min
  await db.query('DELETE FROM otp_store WHERE phone = ?', [phone]);
  await db.query('INSERT INTO otp_store (phone, otp, expires_at) VALUES (?, ?, ?)', [phone, otp, expiresAt]);
}

// ── Verify OTP from DB ────────────────────────────────────────
async function verifyOTP(phone, otp) {
  const [rows] = await db.query(
    'SELECT * FROM otp_store WHERE phone = ? AND otp = ? AND expires_at > NOW() AND used = 0',
    [phone, otp]
  );
  if (!rows.length) return false;
  await db.query('UPDATE otp_store SET used = 1 WHERE id = ?', [rows[0].id]);
  return true;
}

module.exports = { generateOTP, sendOTP, storeOTP, verifyOTP };
