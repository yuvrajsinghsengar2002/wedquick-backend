const router = require('express').Router();
const db     = require('../../config/db');
const { authUser } = require('../middleware/auth');

router.get('/:orderNumber', authUser, async (req, res) => {
  const [[order]] = await db.query(
    `SELECT o.order_number, o.status, o.delivery_mode, o.rider_name, o.rider_phone, o.tracking_id, o.updated_at,
            v.store_name, v.phone AS vendor_phone
     FROM orders o JOIN vendors v ON v.id = o.vendor_id
     WHERE o.order_number = ? AND o.user_id = ?`,
    [req.params.orderNumber, req.user.id]
  );
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  res.json({ success: true, data: order });
});

module.exports = router;
