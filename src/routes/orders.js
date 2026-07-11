const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const db     = require('../../config/db');
const { authUser } = require('../middleware/auth');
const { notifyOrderPlaced } = require('../helpers/whatsapp');

// Generate order number
function genOrderNumber() {
  return `WQ-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
}

// POST /api/v1/orders  — place an order
router.post('/', authUser, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const {
      vendor_id, items, delivery_mode = 'standard',
      address_id, coupon_code, scheduled_at,
    } = req.body;

    if (!items?.length || !address_id)
      return res.status(400).json({ success: false, message: 'Items and delivery address required' });

    // Fetch address
    const [[addr]] = await conn.query('SELECT * FROM user_addresses WHERE id = ? AND user_id = ?', [address_id, req.user.id]);
    if (!addr) return res.status(400).json({ success: false, message: 'Address not found' });

    // Calculate totals
    let subtotal = 0;
    const orderItems = [];
    for (const item of items) {
      const [[prod]] = await conn.query('SELECT * FROM products WHERE uuid = ? AND is_active = 1', [item.product_uuid]);
      if (!prod) throw new Error(`Product ${item.product_uuid} not found`);
      if (prod.stock < item.quantity) throw new Error(`Insufficient stock for ${prod.name}`);
      const lineTotal = prod.price * item.quantity;
      subtotal += lineTotal;
      orderItems.push({ product_id: prod.id, name: prod.name, price: prod.price, quantity: item.quantity, subtotal: lineTotal });
    }

    const deliveryCharge = delivery_mode === 'urgent' ? 60 : 20;
    const expressCharge  = delivery_mode === 'urgent' ? 60 : 0;
    const gstAmount      = parseFloat(((subtotal + deliveryCharge + expressCharge) * 0.18).toFixed(2));

    // Coupon
    let discountAmount = 0;
    if (coupon_code) {
      const [[coupon]] = await conn.query(
        'SELECT * FROM coupons WHERE code = ? AND is_active = 1 AND valid_from <= CURDATE() AND valid_to >= CURDATE() AND used_count < usage_limit',
        [coupon_code]
      );
      if (coupon) {
        discountAmount = coupon.type === 'flat'
          ? Math.min(coupon.value, subtotal)
          : Math.min((subtotal * coupon.value) / 100, coupon.max_discount || Infinity);
        await conn.query('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?', [coupon.id]);
      }
    }

    const totalAmount  = subtotal + deliveryCharge + expressCharge + gstAmount - discountAmount;
    const orderNumber  = genOrderNumber();

    // Fetch vendor id
    const [[vendor]] = await conn.query('SELECT id FROM vendors WHERE uuid = ?', [vendor_id]);
    if (!vendor) throw new Error('Vendor not found');

    // Create order
    const [result] = await conn.query(
      `INSERT INTO orders (order_number, user_id, vendor_id, type, delivery_mode,
        delivery_address, scheduled_at, subtotal, delivery_charge, express_charge,
        discount_amount, gst_amount, total_amount, coupon_code)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [orderNumber, req.user.id, vendor.id, 'purchase', delivery_mode,
       JSON.stringify(addr), scheduled_at || null,
       subtotal, deliveryCharge, expressCharge,
       discountAmount, gstAmount, totalAmount, coupon_code || null]
    );
    const orderId = result.insertId;

    // Insert items & deduct stock
    for (const item of orderItems) {
      await conn.query(
        'INSERT INTO order_items (order_id, product_id, name, price, quantity, subtotal) VALUES (?,?,?,?,?,?)',
        [orderId, item.product_id, item.name, item.price, item.quantity, item.subtotal]
      );
      await conn.query('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.product_id]);
    }

    await conn.commit();

    // Notify customer via WhatsApp
    const [[user]] = await db.query('SELECT phone FROM users WHERE id = ?', [req.user.id]);
    notifyOrderPlaced(user.phone, orderNumber, totalAmount.toFixed(2));

    res.status(201).json({ success: true, message: 'Order placed successfully', orderNumber, orderId: result.insertId, total: totalAmount });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(400).json({ success: false, message: err.message || 'Order placement failed' });
  } finally {
    conn.release();
  }
});

// GET /api/v1/orders  — list user orders
router.get('/', authUser, async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;
  let where = 'WHERE o.user_id = ?';
  const params = [req.user.id];
  if (status) { where += ' AND o.status = ?'; params.push(status); }

  const [orders] = await db.query(
    `SELECT o.id, o.order_number, o.status, o.delivery_mode, o.total_amount,
            o.payment_status, o.created_at, v.store_name AS vendor_name
     FROM orders o JOIN vendors v ON v.id = o.vendor_id
     ${where} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
    [...params, +limit, offset]
  );
  res.json({ success: true, data: orders });
});

// GET /api/v1/orders/:orderNumber
router.get('/:orderNumber', authUser, async (req, res) => {
  const [[order]] = await db.query(
    `SELECT o.*, v.store_name, v.phone AS vendor_phone FROM orders o
     JOIN vendors v ON v.id = o.vendor_id
     WHERE o.order_number = ? AND o.user_id = ?`,
    [req.params.orderNumber, req.user.id]
  );
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  const [items] = await db.query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
  res.json({ success: true, data: { ...order, items } });
});

// PUT /api/v1/orders/:orderNumber/cancel
router.put('/:orderNumber/cancel', authUser, async (req, res) => {
  const [[order]] = await db.query('SELECT * FROM orders WHERE order_number = ? AND user_id = ?', [req.params.orderNumber, req.user.id]);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  if (!['pending', 'accepted'].includes(order.status))
    return res.status(400).json({ success: false, message: 'Order cannot be cancelled at this stage' });

  await db.query("UPDATE orders SET status = 'cancelled' WHERE id = ?", [order.id]);
  res.json({ success: true, message: 'Order cancelled successfully' });
});

module.exports = router;
