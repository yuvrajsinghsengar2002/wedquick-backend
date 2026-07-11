const router = require('express').Router();
const db     = require('../../config/db');
const { authUser } = require('../middleware/auth');

// GET /api/v1/profile
router.get('/', authUser, async (req, res) => {
  const [[user]] = await db.query('SELECT id, uuid, phone, name, email, profile_pic, event_date, created_at FROM users WHERE id = ?', [req.user.id]);
  const [addresses] = await db.query('SELECT * FROM user_addresses WHERE user_id = ?', [req.user.id]);
  res.json({ success: true, data: { ...user, addresses } });
});

// PUT /api/v1/profile
router.put('/', authUser, async (req, res) => {
  const { name, email, event_date } = req.body;
  await db.query('UPDATE users SET name = ?, email = ?, event_date = ? WHERE id = ?', [name, email, event_date, req.user.id]);
  res.json({ success: true, message: 'Profile updated' });
});

// POST /api/v1/profile/addresses
router.post('/addresses', authUser, async (req, res) => {
  const { label, full_address, pincode, city, state, lat, lng, is_default } = req.body;
  if (!full_address || !pincode) return res.status(400).json({ success: false, message: 'full_address and pincode required' });

  if (is_default) await db.query('UPDATE user_addresses SET is_default = 0 WHERE user_id = ?', [req.user.id]);
  await db.query(
    'INSERT INTO user_addresses (user_id, label, full_address, pincode, city, state, lat, lng, is_default) VALUES (?,?,?,?,?,?,?,?,?)',
    [req.user.id, label || 'Home', full_address, pincode, city, state, lat, lng, is_default ? 1 : 0]
  );
  res.status(201).json({ success: true, message: 'Address added' });
});

// DELETE /api/v1/profile/addresses/:id
router.delete('/addresses/:id', authUser, async (req, res) => {
  await db.query('DELETE FROM user_addresses WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  res.json({ success: true, message: 'Address deleted' });
});

module.exports = router;
