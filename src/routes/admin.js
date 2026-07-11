const router = require('express').Router();
const db     = require('../../config/db');
const { authStaff } = require('../middleware/auth');

// ── Orders ────────────────────────────────────────────────────
// GET /api/v1/admin/orders
router.get('/orders', authStaff('super_admin','ops_manager'), async (req, res) => {
  const { status, type, page = 1, limit = 30 } = req.query;
  const offset = (page - 1) * limit;
  let where = 'WHERE 1=1';
  const params = [];
  if (status) { where += ' AND o.status = ?'; params.push(status); }
  if (type)   { where += ' AND o.type = ?';   params.push(type); }

  const [orders] = await db.query(
    `SELECT o.*, u.name AS customer_name, u.phone AS customer_phone, v.store_name
     FROM orders o
     JOIN users u   ON u.id = o.user_id
     JOIN vendors v ON v.id = o.vendor_id
     ${where} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
    [...params, +limit, offset]
  );
  res.json({ success: true, data: orders });
});

// PUT /api/v1/admin/orders/:id/status
router.put('/orders/:id/status', authStaff('super_admin','ops_manager'), async (req, res) => {
  const { status, rider_name, rider_phone, tracking_id } = req.body;
  await db.query(
    'UPDATE orders SET status = ?, rider_name = ?, rider_phone = ?, tracking_id = ? WHERE id = ?',
    [status, rider_name, rider_phone, tracking_id, req.params.id]
  );
  res.json({ success: true, message: 'Order updated' });
});

// ── Vendors ───────────────────────────────────────────────────
router.get('/vendors', authStaff('super_admin','ops_manager'), async (req, res) => {
  const { kyc_status } = req.query;
  let where = 'WHERE 1=1';
  const params = [];
  if (kyc_status) { where += ' AND kyc_status = ?'; params.push(kyc_status); }
  const [vendors] = await db.query(`SELECT * FROM vendors ${where} ORDER BY created_at DESC`, params);
  res.json({ success: true, data: vendors });
});

router.put('/vendors/:id/approve', authStaff('super_admin'), async (req, res) => {
  await db.query("UPDATE vendors SET kyc_status = 'approved', is_active = 1 WHERE id = ?", [req.params.id]);
  res.json({ success: true, message: 'Vendor approved' });
});

router.put('/vendors/:id/block', authStaff('super_admin'), async (req, res) => {
  await db.query('UPDATE vendors SET is_active = 0 WHERE id = ?', [req.params.id]);
  res.json({ success: true, message: 'Vendor blocked' });
});

// ── Users ─────────────────────────────────────────────────────
router.get('/users', authStaff('super_admin','ops_manager'), async (req, res) => {
  const { page = 1, limit = 30 } = req.query;
  const [users] = await db.query(
    'SELECT id, uuid, phone, name, email, created_at, is_active FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [+limit, (+page - 1) * +limit]
  );
  res.json({ success: true, data: users });
});

// ── Custom Requirements ───────────────────────────────────────
router.get('/requirements', authStaff('super_admin','ops_manager','sales_exec'), async (req, res) => {
  const { status } = req.query;
  let where = 'WHERE 1=1';
  const params = [];
  if (status) { where += ' AND cr.status = ?'; params.push(status); }

  const [rows] = await db.query(
    `SELECT cr.*, u.name AS customer_name, u.phone AS customer_phone
     FROM custom_requirements cr JOIN users u ON u.id = cr.user_id
     ${where} ORDER BY cr.created_at DESC`,
    params
  );
  res.json({ success: true, data: rows });
});

router.put('/requirements/:id/assign', authStaff('super_admin','ops_manager'), async (req, res) => {
  const { staff_id } = req.body;
  await db.query("UPDATE custom_requirements SET assigned_to = ?, status = 'assigned' WHERE id = ?", [staff_id, req.params.id]);
  res.json({ success: true, message: 'Requirement assigned' });
});

// ── Quotations ────────────────────────────────────────────────
router.post('/quotations', authStaff('super_admin','ops_manager','sales_exec'), async (req, res) => {
  const { v4: uuidv4 } = require('uuid');
  const { requirement_id, user_id, items, notes, validity_date } = req.body;
  const subtotal    = items.reduce((s, i) => s + i.price * i.qty, 0);
  const gstAmount   = parseFloat((subtotal * 0.18).toFixed(2));
  const totalAmount = subtotal + gstAmount;
  const uuid        = uuidv4();

  await db.query(
    `INSERT INTO quotations (uuid, requirement_id, user_id, created_by, items, subtotal, gst_amount, total_amount, validity_date, notes)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [uuid, requirement_id, user_id, req.staff.id, JSON.stringify(items), subtotal, gstAmount, totalAmount, validity_date, notes]
  );
  await db.query("UPDATE custom_requirements SET status = 'quoted' WHERE id = ?", [requirement_id]);
  res.status(201).json({ success: true, message: 'Quotation created', uuid, totalAmount });
});

// ── Analytics ─────────────────────────────────────────────────
router.get('/analytics', authStaff('super_admin','ops_manager','finance_exec'), async (req, res) => {
  const [[revenue]]  = await db.query("SELECT SUM(total_amount) AS total FROM orders WHERE payment_status = 'paid'");
  const [[orders]]   = await db.query('SELECT COUNT(*) AS total FROM orders');
  const [[pending]]  = await db.query("SELECT COUNT(*) AS total FROM orders WHERE status = 'pending'");
  const [[vendors]]  = await db.query("SELECT COUNT(*) AS total FROM vendors WHERE is_active = 1");
  const [[users]]    = await db.query('SELECT COUNT(*) AS total FROM users');
  const [[reqs]]     = await db.query("SELECT COUNT(*) AS total FROM custom_requirements WHERE status = 'new'");

  res.json({ success: true, data: {
    totalRevenue:      revenue.total || 0,
    totalOrders:       orders.total,
    pendingOrders:     pending.total,
    activeVendors:     vendors.total,
    totalCustomers:    users.total,
    openRequirements:  reqs.total,
  }});
});

// ── Banners ───────────────────────────────────────────────────
router.post('/banners', authStaff('super_admin','ops_manager'), async (req, res) => {
  const { title, image_url, link_type, link_value, sort_order } = req.body;
  await db.query('INSERT INTO banners (title, image_url, link_type, link_value, sort_order) VALUES (?,?,?,?,?)',
    [title, image_url, link_type || 'none', link_value, sort_order || 0]);
  res.status(201).json({ success: true, message: 'Banner created' });
});

router.put('/banners/:id', authStaff('super_admin','ops_manager'), async (req, res) => {
  const { title, image_url, is_active, sort_order } = req.body;
  await db.query('UPDATE banners SET title=?, image_url=?, is_active=?, sort_order=? WHERE id=?',
    [title, image_url, is_active, sort_order, req.params.id]);
  res.json({ success: true, message: 'Banner updated' });
});

module.exports = router;
