const router = require('express').Router();
const db     = require('../../config/db');
const { authUser } = require('../middleware/auth');

router.post('/', authUser, async (req, res) => {
  const { product_uuid, order_id, rating, comment } = req.body;
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ success: false, message: 'Rating must be 1–5' });
  try {
    const [[p]] = await db.query('SELECT id FROM products WHERE uuid = ?', [product_uuid]);
    await db.query('INSERT INTO reviews (product_id, user_id, order_id, rating, comment) VALUES (?,?,?,?,?)', [p.id, req.user.id, order_id, rating, comment]);
    await db.query('UPDATE products SET rating_avg = (SELECT AVG(rating) FROM reviews WHERE product_id = ?), rating_count = (SELECT COUNT(*) FROM reviews WHERE product_id = ?) WHERE id = ?', [p.id, p.id, p.id]);
    res.status(201).json({ success: true, message: 'Review submitted' });
  } catch { res.status(409).json({ success: false, message: 'Already reviewed this product for this order' }); }
});

module.exports = router;
