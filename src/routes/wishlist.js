const router = require('express').Router();
const db     = require('../../config/db');
const { authUser } = require('../middleware/auth');

router.get('/',     authUser, async (req, res) => { const [r] = await db.query('SELECT w.*, p.name, p.price, p.images FROM wishlists w JOIN products p ON p.id = w.product_id WHERE w.user_id = ?', [req.user.id]); res.json({ success: true, data: r }); });
router.post('/',    authUser, async (req, res) => { try { await db.query('INSERT INTO wishlists (user_id, product_id) VALUES (?, (SELECT id FROM products WHERE uuid = ?))', [req.user.id, req.body.product_uuid]); res.status(201).json({ success: true }); } catch { res.status(409).json({ success: false, message: 'Already in wishlist' }); }});
router.delete('/:uuid', authUser, async (req, res) => { await db.query('DELETE FROM wishlists WHERE user_id = ? AND product_id = (SELECT id FROM products WHERE uuid = ?)', [req.user.id, req.params.uuid]); res.json({ success: true }); });

module.exports = router;
