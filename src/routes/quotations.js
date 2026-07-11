const router = require('express').Router();
const db     = require('../../config/db');
const { authUser } = require('../middleware/auth');

router.get('/:uuid', authUser, async (req, res) => {
  const [[q]] = await db.query(
    `SELECT qt.*, cr.description AS requirement_desc
     FROM quotations qt JOIN custom_requirements cr ON cr.id = qt.requirement_id
     WHERE qt.uuid = ? AND qt.user_id = ?`,
    [req.params.uuid, req.user.id]
  );
  if (!q) return res.status(404).json({ success: false, message: 'Quotation not found' });
  res.json({ success: true, data: q });
});

router.put('/:uuid/accept', authUser, async (req, res) => {
  await db.query("UPDATE quotations SET status = 'accepted' WHERE uuid = ? AND user_id = ?", [req.params.uuid, req.user.id]);
  res.json({ success: true, message: 'Quotation accepted' });
});

router.put('/:uuid/reject', authUser, async (req, res) => {
  await db.query("UPDATE quotations SET status = 'rejected' WHERE uuid = ? AND user_id = ?", [req.params.uuid, req.user.id]);
  res.json({ success: true, message: 'Quotation rejected' });
});

module.exports = router;
