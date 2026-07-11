const jwt  = require('jsonwebtoken');

// Verify JWT for customers
exports.authUser = (req, res, next) => {
  const token = _extractToken(req);
  if (!token) return res.status(401).json({ success: false, message: 'Access token required' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

// Verify JWT for vendors
exports.authVendor = (req, res, next) => {
  const token = _extractToken(req);
  if (!token) return res.status(401).json({ success: false, message: 'Access token required' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'vendor') return res.status(403).json({ success: false, message: 'Vendor access only' });
    req.vendor = decoded;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

// Verify JWT for admin staff
exports.authStaff = (...allowedRoles) => (req, res, next) => {
  const token = _extractToken(req);
  if (!token) return res.status(401).json({ success: false, message: 'Access token required' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!['super_admin','ops_manager','sales_exec','finance_exec','support_exec'].includes(decoded.role))
      return res.status(403).json({ success: false, message: 'Staff access only' });
    if (allowedRoles.length && !allowedRoles.includes(decoded.role))
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    req.staff = decoded;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

function _extractToken(req) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}
