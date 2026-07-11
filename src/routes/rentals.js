const router = require('express').Router();
const db     = require('../../config/db');
const { authUser } = require('../middleware/auth');

// POST /api/v1/rentals  — book a rental
router.post('/', authUser, async (req, res) => {
  const { product_uuid, pickup_date, return_date, address_id } = req.body;
  if (!product_uuid || !pickup_date || !return_date || !address_id)
    return res.status(400).json({ success: false, message: 'product_uuid, pickup_date, return_date, address_id required' });

  const [[product]] = await db.query('SELECT * FROM products WHERE uuid = ? AND rental_eligible = 1 AND is_active = 1', [product_uuid]);
  if (!product) return res.status(404).json({ success: false, message: 'Rental product not found' });

  const [[addr]] = await db.query('SELECT * FROM user_addresses WHERE id = ? AND user_id = ?', [address_id, req.user.id]);
  if (!addr) return res.status(400).json({ success: false, message: 'Address not found' });

  const pickup  = new Date(pickup_date);
  const ret     = new Date(return_date);
  const days    = Math.ceil((ret - pickup) / (1000 * 60 * 60 * 24));
  if (days < (product.min_rental_days || 1))
    return res.status(400).json({ success: false, message: `Minimum rental period is ${product.min_rental_days} day(s)` });

  const rentalAmount = product.rental_price_day * days;
  const totalAmount  = rentalAmount + product.rental_deposit;
  const orderNumber  = `WQR-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      `INSERT INTO orders (order_number, user_id, vendor_id, type, delivery_mode, delivery_address, subtotal, total_amount, payment_status)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [orderNumber, req.user.id, product.vendor_id, 'rental', 'scheduled', JSON.stringify(addr), rentalAmount, totalAmount, 'pending']
    );
    await conn.query(
      `INSERT INTO rentals (order_id, product_id, user_id, pickup_date, return_date, rental_days, rental_amount, deposit_amount)
       VALUES (?,?,?,?,?,?,?,?)`,
      [result.insertId, product.id, req.user.id, pickup_date, return_date, days, rentalAmount, product.rental_deposit]
    );
    await conn.commit();
    res.status(201).json({ success: true, message: 'Rental booked', orderNumber, totalAmount, rentalDays: days });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: 'Rental booking failed' });
  } finally {
    conn.release();
  }
});

// GET /api/v1/rentals  — list user rentals
router.get('/', authUser, async (req, res) => {
  const [rows] = await db.query(
    `SELECT r.*, o.order_number, o.status, o.total_amount,
            p.name AS product_name, p.images
     FROM rentals r
     JOIN orders o   ON o.id  = r.order_id
     JOIN products p ON p.id  = r.product_id
     WHERE r.user_id = ?
     ORDER BY r.pickup_date DESC`,
    [req.user.id]
  );
  res.json({ success: true, data: rows });
});

module.exports = router;
