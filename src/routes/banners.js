const router = require('express').Router();
const db     = require('../../config/db');
const { authUser } = require('../middleware/auth');

router.get('/', async (req, res) => { const [r] = await db.query('SELECT * FROM banners WHERE is_active = 1 ORDER BY sort_order'); res.json({ success: true, data: r }); });

module.exports = router;
