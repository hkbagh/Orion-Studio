import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { countUsers } from '../db/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'orion-studio-dev-secret-change-me';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

/**
 * Generate a JWT token for a user
 */
export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/**
 * Express middleware: require authentication
 * In development mode, bypasses auth if no users exist in the database.
 */
export function requireAuth(req, res, next) {
  // In dev mode, bypass auth if no users configured
  if (config.isDev && countUsers() === 0) {
    req.user = { id: 'dev', username: 'developer', role: 'admin' };
    return next();
  }

  authenticateRequest(req, res, next);
}

/**
 * Express middleware: require admin role
 */
export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
}

/**
 * WebSocket authentication helper
 * Extracts token from query string or protocol header
 */
export function authenticateWebSocket(request) {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      // In dev mode, allow unauthenticated connections
      if (config.isDev) {
        return { id: 'dev', username: 'developer', role: 'admin' };
      }
      return null;
    }

    return verifyToken(token);
  } catch {
    return null;
  }
}

/**
 * Internal: authenticate a request
 */
function authenticateRequest(req, res, next) {
  const authHeader = req.headers.authorization;
  const queryToken = req.query?.token;

  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : queryToken;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export { JWT_SECRET };
