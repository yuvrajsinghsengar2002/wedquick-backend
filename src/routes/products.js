const router = require('express').Router();
const db     = require('../../config/db');
const { authUser } = require('../middleware/auth');

// GET /api/v1/products  — public listing with filters
router.get('/', async (req, res) => {
  try {
    const { category, type, pincode, search, urgent, rental, featured, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    let where = 'WHERE p.is_active = 1 AND v.is_active = 1';

    if (category) { where += ' AND c.slug = ?';   params.push(category); }
    if (type)     { where += ' AND FIND_IN_SET(?, p.delivery_type)'; params.push(type); }
    if (urgent)   { where += ' AND p.urgent_eligible = 1'; }
    if (rental)   { where += ' AND p.rental_eligible = 1'; }
    if (featured) { where += ' AND p.is_featured = 1'; }
    if (search)   { where += ' AND p.name LIKE ?'; params.push(`%${search}%`); }
    if (pincode)  { where += ' AND EXISTS (SELECT 1 FROM vendor_pincodes vp WHERE vp.vendor_id = v.id AND vp.pincode = ?)'; params.push(pincode); }

    const [rows] = await db.query(
      `SELECT p.id, p.uuid, p.name, p.price, p.mrp, p.stock, p.images,
              p.delivery_type, p.urgent_eligible, p.rental_eligible,
              p.rental_price_day, p.rental_deposit, p.gst_rate,
              p.rating_avg, p.rating_count, p.is_featured,
              v.store_name AS vendor_name, v.uuid AS vendor_uuid,
              c.name AS category_name, c.slug AS category_slug, c.emoji AS category_emoji
       FROM products p
       JOIN vendors v    ON v.id = p.vendor_id
       JOIN categories c ON c.id = p.category_id
       ${where}
       ORDER BY p.is_featured DESC, p.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM products p JOIN vendors v ON v.id = p.vendor_id JOIN categories c ON c.id = p.category_id ${where}`, params);

    res.json({ success: true, data: rows, pagination: { page: +page, limit: +limit, total } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch products' });
  }
});

// GET /api/v1/products/:uuid
router.get('/:uuid', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.*, v.store_name AS vendor_name, v.uuid AS vendor_uuid,
              c.name AS category_name, c.emoji AS category_emoji
       FROM products p
       JOIN vendors v    ON v.id = p.vendor_id
       JOIN categories c ON c.id = p.category_id
       WHERE p.uuid = ? AND p.is_active = 1`,
      [req.params.uuid]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Product not found' });

    const [variants] = await db.query('SELECT * FROM product_variants WHERE product_id = ? AND is_active = 1', [rows[0].id]);
    const [reviews]  = await db.query(
      `SELECT r.rating, r.comment, r.created_at, u.name AS user_name
       FROM reviews r JOIN users u ON u.id = r.user_id
       WHERE r.product_id = ? ORDER BY r.created_at DESC LIMIT 10`,
      [rows[0].id]
    );

    res.json({ success: true, data: { ...rows[0], variants, reviews } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch product' });
  }
});

module.exports = router;
