const { verifyToken } = require('../utils/auth');

function getTokenFromRequest(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme === 'Bearer' && token) return token;
  return null;
}

function requireAuth(req, res, next) {
  const token = getTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  try {
    const payload = verifyToken(token);
    req.userId = payload.userId;
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired session' });
  }
}

function optionalAuth(req, res, next) {
  const token = getTokenFromRequest(req);
  if (!token) return next();

  try {
    const payload = verifyToken(token);
    req.userId = payload.userId;
  } catch (err) {
    // ignore invalid token, treat as anonymous
  }
  return next();
}

module.exports = { requireAuth, optionalAuth };