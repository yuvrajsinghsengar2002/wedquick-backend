const router = require('express').Router();
const crypto = require('crypto');
const db     = require('../../config/db');
const { authUser } = require('../middleware/auth');

// POST /api/v1/payments/create-order  — create Razorpay order
router.post('/create-order', authUser, async (req, res) => {
  const { order_db_id } = req.body;
  const [[order]] = await db.query('SELECT * FROM orders WHERE id = ? AND user_id = ?', [order_db_id, req.user.id]);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

  if (process.env.NODE_ENV !== 'production') {
    const fakeRzpId = `order_dev_${Date.now()}`;
    await db.query('UPDATE orders SET razorpay_order_id = ? WHERE id = ?', [fakeRzpId, order.id]);
    return res.json({ success: true, razorpay_order_id: fakeRzpId, amount: order.total_amount * 100, currency: 'INR' });
  }

  const Razorpay = require('razorpay');
  const rzp = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
  const rzpOrder = await rzp.orders.create({ amount: Math.round(order.total_amount * 100), currency: 'INR', receipt: order.order_number });
  await db.query('UPDATE orders SET razorpay_order_id = ? WHERE id = ?', [rzpOrder.id, order.id]);
  res.json({ success: true, razorpay_order_id: rzpOrder.id, amount: rzpOrder.amount, currency: 'INR', key: process.env.RAZORPAY_KEY_ID });
});

// POST /api/v1/payments/verify  — verify Razorpay payment
router.post('/verify', authUser, async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const body    = razorpay_order_id + '|' + razorpay_payment_id;
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'dev').update(body).digest('hex');

  if (expected !== razorpay_signature && process.env.NODE_ENV === 'production')
    return res.status(400).json({ success: false, message: 'Payment verification failed' });

  await db.query(
    "UPDATE orders SET payment_status = 'paid', razorpay_payment_id = ?, status = 'accepted' WHERE razorpay_order_id = ?",
    [razorpay_payment_id, razorpay_order_id]
  );
  res.json({ success: true, message: 'Payment verified successfully' });
});

// POST /api/v1/payments/webhook  — Razorpay webhook
router.post('/webhook', express_raw_body(), async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const body      = req.rawBody;
  const expected  = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || 'dev').update(body).digest('hex');

  if (signature !== expected) return res.status(400).send('Invalid signature');

  const event = JSON.parse(body);
  if (event.event === 'payment.captured') {
    const pid = event.payload.payment.entity.id;
    const oid = event.payload.payment.entity.order_id;
    await db.query("UPDATE orders SET payment_status = 'paid', razorpay_payment_id = ? WHERE razorpay_order_id = ?", [pid, oid]);
  }
  res.json({ status: 'ok' });
});

function express_raw_body() {
  return require('express').raw({ type: 'application/json' });
}

module.exports = router;
