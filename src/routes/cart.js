const router = require('express').Router();
const { authUser } = require('../middleware/auth');

// In-memory cart (stateless — client holds cart, this validates + calculates)
router.post('/validate', authUser, async (req, res) => {
  const db = require('../../config/db');
  const { items } = req.body;
  if (!items?.length) return res.status(400).json({ success: false, message: 'Items required' });

  const results = [];
  for (const item of items) {
    const [[p]] = await db.query('SELECT uuid, name, price, mrp, stock, images, urgent_eligible FROM products WHERE uuid = ? AND is_active = 1', [item.product_uuid]);
    if (!p) { results.push({ product_uuid: item.product_uuid, available: false, reason: 'Product unavailable' }); continue; }
    if (p.stock < item.quantity) { results.push({ ...p, available: false, reason: `Only ${p.stock} in stock` }); continue; }
    results.push({ ...p, available: true, quantity: item.quantity, lineTotal: p.price * item.quantity });
  }

  const subtotal = results.filter(r => r.available).reduce((s, r) => s + r.lineTotal, 0);
  res.json({ success: true, items: results, subtotal });
});

module.exports = router;
