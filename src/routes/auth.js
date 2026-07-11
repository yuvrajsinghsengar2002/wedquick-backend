const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db      = require('../../config/db');
const { generateOTP, sendOTP, storeOTP, verifyOTP } = require('../helpers/otp');
const { issueTokens, verifyRefreshToken, revokeRefreshToken } = require('../helpers/tokens');

// POST /api/v1/auth/send-otp
router.post('/send-otp', async (req, res) => {
  const { phone } = req.body;
  if (!phone || !/^[6-9]\d{9}$/.test(phone))
    return res.status(400).json({ success: false, message: 'Valid 10-digit mobile number required' });

  const otp = generateOTP();
  await storeOTP(phone, otp);
  const sent = await sendOTP(phone, otp);
  if (!sent) return res.status(500).json({ success: false, message: 'Failed to send OTP' });

  res.json({ success: true, message: 'OTP sent successfully' });
});

// POST /api/v1/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp)
    return res.status(400).json({ success: false, message: 'Phone and OTP required' });

  const valid = await verifyOTP(phone, otp);
  if (!valid) return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });

  // Find or create user
  let [users] = await db.query('SELECT * FROM users WHERE phone = ?', [phone]);
  let user = users[0];
  let isNew = false;

  if (!user) {
    const uuid = uuidv4();
    await db.query('INSERT INTO users (uuid, phone) VALUES (?, ?)', [uuid, phone]);
    [users] = await db.query('SELECT * FROM users WHERE phone = ?', [phone]);
    user = users[0];
    isNew = true;
  }

  const tokens = await issueTokens({ id: user.id, uuid: user.uuid, phone, role: 'user' });
  res.json({
    success: true,
    isNew,
    user: { id: user.uuid, phone: user.phone, name: user.name, profilePic: user.profile_pic },
    ...tokens,
  });
});

// POST /api/v1/auth/vendor/login
router.post('/vendor/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ success: false, message: 'Email and password required' });

  const [rows] = await db.query('SELECT * FROM vendors WHERE email = ?', [email]);
  const vendor = rows[0];
  if (!vendor || !await bcrypt.compare(password, vendor.password_hash))
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  if (!vendor.is_active)
    return res.status(403).json({ success: false, message: 'Account pending approval' });

  const tokens = await issueTokens({ id: vendor.id, uuid: vendor.uuid, role: 'vendor', storeName: vendor.store_name });
  res.json({ success: true, vendor: { id: vendor.uuid, storeName: vendor.store_name, email: vendor.email }, ...tokens });
});

// POST /api/v1/auth/staff/login
router.post('/staff/login', async (req, res) => {
  const { email, password } = req.body;
  const [rows] = await db.query('SELECT * FROM staff WHERE email = ? AND is_active = 1', [email]);
  const staff = rows[0];
  if (!staff || !await bcrypt.compare(password, staff.password_hash))
    return res.status(401).json({ success: false, message: 'Invalid credentials' });

  const tokens = await issueTokens({ id: staff.id, uuid: staff.uuid, role: staff.role, name: staff.name });
  res.json({ success: true, staff: { id: staff.uuid, name: staff.name, role: staff.role }, ...tokens });
});

// POST /api/v1/auth/refresh
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ success: false, message: 'Refresh token required' });

  const tokenRow = await verifyRefreshToken(refreshToken);
  if (!tokenRow) return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });

  const entityId = tokenRow.user_id || tokenRow.vendor_id || tokenRow.staff_id;
  const role     = tokenRow.user_id ? 'user' : tokenRow.vendor_id ? 'vendor' : 'staff';
  await revokeRefreshToken(refreshToken);

  const tokens = await issueTokens({ id: entityId, role });
  res.json({ success: true, ...tokens });
});

// POST /api/v1/auth/logout
router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) await revokeRefreshToken(refreshToken);
  res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;
