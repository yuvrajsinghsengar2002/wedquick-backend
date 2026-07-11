const router  = require('express').Router();
const db      = require('../../config/db');
const bcrypt  = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { authVendor } = require('../middleware/auth');

// POST /api/v1/vendor/register
router.post('/register', async (req, res) => {
  const { store_name, owner_name, phone, email, password, city, pincode, serviceable_pincodes } = req.body;
  if (!store_name || !phone || !email || !password)
    return res.status(400).json({ success: false, message: 'store_name, phone, email, password required' });

  const [existing] = await db.query('SELECT id FROM vendors WHERE phone = ? OR email = ?', [phone, email]);
  if (existing.length) return res.status(409).json({ success: false, message: 'Phone or email already registered' });

  const hash = await bcrypt.hash(password, 10);
  const uuid = uuidv4();
  const [result] = await db.query(
    'INSERT INTO vendors (uuid, store_name, owner_name, phone, email, password_hash, city, pincode) VALUES (?,?,?,?,?,?,?,?)',
    [uuid, store_name, owner_name, phone, email, hash, city, pincode]
  );

  if (serviceable_pincodes?.length) {
    for (const p of serviceable_pincodes) {
      await db.query('INSERT IGNORE INTO vendor_pincodes (vendor_id, pincode) VALUES (?,?)', [result.insertId, p]);
    }
  }

  res.status(201).json({ success: true, message: 'Registration submitted. Await admin approval.', uuid });
});

// GET /api/v1/vendor/dashboard
router.get('/dashboard', authVendor, async (req, res) => {
  const [[stats]] = await db.query(
    `SELECT
       COUNT(*) AS total_orders,
       SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_orders,
       SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS delivered_orders,
       SUM(CASE WHEN status = 'delivered' AND payment_status = 'paid' THEN total_amount ELSE 0 END) AS total_revenue
     FROM orders WHERE vendor_id = ?`,
    [req.vendor.id]
  );
  const [[prodStats]] = await db.query(
    'SELECT COUNT(*) AS total_products, SUM(stock) AS total_stock FROM products WHERE vendor_id = ?',
    [req.vendor.id]
  );
  res.json({ success: true, data: { ...stats, ...prodStats } });
});

// GET /api/v1/vendor/orders
router.get('/orders', authVendor, async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  let where = 'WHERE o.vendor_id = ?';
  const params = [req.vendor.id];
  if (status) { where += ' AND o.status = ?'; params.push(status); }

  const [orders] = await db.query(
    `SELECT o.id, o.order_number, o.status, o.delivery_mode, o.total_amount, o.created_at,
            u.name AS customer_name, u.phone AS customer_phone
     FROM orders o JOIN users u ON u.id = o.user_id
     ${where} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
    [...params, +limit, offset]
  );
  res.json({ success: true, data: orders });
});

// PUT /api/v1/vendor/orders/:id/status
router.put('/orders/:id/status', authVendor, async (req, res) => {
  const { status } = req.body;
  const allowed = ['accepted', 'packing', 'ready', 'cancelled'];
  if (!allowed.includes(status))
    return res.status(400).json({ success: false, message: `Status must be one of: ${allowed.join(', ')}` });

  const [[order]] = await db.query('SELECT * FROM orders WHERE id = ? AND vendor_id = ?', [req.params.id, req.vendor.id]);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

  await db.query('UPDATE orders SET status = ? WHERE id = ?', [status, order.id]);
  res.json({ success: true, message: `Order status updated to ${status}` });
});

// GET /api/v1/vendor/products
router.get('/products', authVendor, async (req, res) => {
  const [products] = await db.query(
    'SELECT * FROM products WHERE vendor_id = ? ORDER BY created_at DESC',
    [req.vendor.id]
  );
  res.json({ success: true, data: products });
});

// POST /api/v1/vendor/products
router.post('/products', authVendor, async (req, res) => {
  const { v4: uuidv4 } = require('uuid');
  const { name, description, category_id, price, mrp, stock, unit, images,
          urgent_eligible, rental_eligible, rental_price_day, rental_deposit, gst_rate } = req.body;
  if (!name || !price || !category_id)
    return res.status(400).json({ success: false, message: 'name, price, category_id required' });

  const uuid = uuidv4();
  await db.query(
    `INSERT INTO products (uuid, vendor_id, category_id, name, description, price, mrp, stock, unit, images,
      urgent_eligible, rental_eligible, rental_price_day, rental_deposit, gst_rate)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [uuid, req.vendor.id, category_id, name, description, price, mrp, stock || 0, unit || 'piece',
     JSON.stringify(images || []), urgent_eligible ? 1 : 0, rental_eligible ? 1 : 0,
     rental_price_day || null, rental_deposit || null, gst_rate || 18]
  );
  res.status(201).json({ success: true, message: 'Product created', uuid });
});

// PUT /api/v1/vendor/products/:uuid
router.put('/products/:uuid', authVendor, async (req, res) => {
  const fields = ['name', 'description', 'price', 'mrp', 'stock', 'is_active', 'urgent_eligible', 'rental_eligible'];
  const updates = [];
  const values  = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) { updates.push(`${f} = ?`); values.push(req.body[f]); }
  }
  if (!updates.length) return res.status(400).json({ success: false, message: 'No fields to update' });
  values.push(req.params.uuid, req.vendor.id);
  await db.query(`UPDATE products SET ${updates.join(', ')} WHERE uuid = ? AND vendor_id = ?`, values);
  res.json({ success: true, message: 'Product updated' });
});

module.exports = router;
