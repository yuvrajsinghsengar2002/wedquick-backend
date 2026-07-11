const router = require('express').Router();
const db     = require('../../config/db');
const { authUser }   = require('../middleware/auth');
const { authVendor } = require('../middleware/auth');

// POST /api/v1/requirements  — customer submits custom requirement
router.post('/', authUser, async (req, res) => {
  const { v4: uuidv4 } = require('uuid');
  const { event_type, event_date, location, budget_min, budget_max, quantity, description, reference_images } = req.body;
  if (!description) return res.status(400).json({ success: false, message: 'Description required' });

  const uuid = uuidv4();
  await db.query(
    `INSERT INTO custom_requirements (uuid, user_id, event_type, event_date, location, budget_min, budget_max, quantity, description, reference_images)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [uuid, req.user.id, event_type, event_date, location, budget_min, budget_max, quantity, description, JSON.stringify(reference_images || [])]
  );
  res.status(201).json({ success: true, message: 'Requirement submitted. Our team will contact you shortly.', uuid });
});

// GET /api/v1/requirements  — user's requirements
router.get('/', authUser, async (req, res) => {
  const [rows] = await db.query(
    'SELECT * FROM custom_requirements WHERE user_id = ? ORDER BY created_at DESC',
    [req.user.id]
  );
  res.json({ success: true, data: rows });
});

module.exports = router;
