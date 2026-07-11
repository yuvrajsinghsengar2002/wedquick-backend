const router = require('express').Router();
const db     = require('../../config/db');
const { authUser } = require('../middleware/auth');

router.get('/',    authUser, async (req, res) => { const [r] = await db.query('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [req.user.id]); res.json({ success: true, data: r }); });
router.put('/read', authUser, async (req, res) => { await db.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]); res.json({ success: true }); });

module.exports = router;
