const router = require('express').Router();
const db     = require('../../config/db');

router.get('/', async (req, res) => { const [r] = await db.query('SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order'); res.json({ success: true, data: r }); });
router.get('/:slug/products', async (req, res) => { const [r] = await db.query('SELECT p.* FROM products p JOIN categories c ON c.id = p.category_id WHERE c.slug = ? AND p.is_active = 1', [req.params.slug]); res.json({ success: true, data: r }); });

module.exports = router;
