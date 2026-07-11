const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const db     = require('../../config/db');

// ── Issue access + refresh tokens ────────────────────────────
async function issueTokens(payload) {
  const accessToken  = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
  const refreshToken = crypto.randomBytes(64).toString('hex');
  const hash         = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const expiresAt    = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db.query(
    `INSERT INTO refresh_tokens (${payload.role === 'vendor' ? 'vendor_id' : payload.role === 'user' ? 'user_id' : 'staff_id'}, token_hash, expires_at)
     VALUES (?, ?, ?)`,
    [payload.id, hash, expiresAt]
  );
  return { accessToken, refreshToken };
}

// ── Verify refresh token ──────────────────────────────────────
async function verifyRefreshToken(refreshToken) {
  const hash   = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const [rows] = await db.query('SELECT * FROM refresh_tokens WHERE token_hash = ? AND expires_at > NOW()', [hash]);
  return rows[0] || null;
}

// ── Revoke refresh token ──────────────────────────────────────
async function revokeRefreshToken(refreshToken) {
  const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  await db.query('DELETE FROM refresh_tokens WHERE token_hash = ?', [hash]);
}

module.exports = { issueTokens, verifyRefreshToken, revokeRefreshToken };
