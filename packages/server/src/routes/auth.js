import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import {
  createUser,
  getUserByUsername,
  updateUserLogin,
  countUsers,
  listUsers,
} from '../db/database.js';
import { generateToken, requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/auth/setup
 * Initial setup — create the first admin user.
 * Only works when no users exist.
 */
router.post('/auth/setup', async (req, res, next) => {
  try {
    const userCount = countUsers();
    if (userCount > 0) {
      return res.status(400).json({ error: 'Setup already completed. Use /auth/login.' });
    }

    const { username, password, email } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const id = uuidv4().substring(0, 12);
    const passwordHash = await bcrypt.hash(password, 12);

    const user = createUser(id, username, email || null, passwordHash, 'admin');
    const token = generateToken(user);

    res.status(201).json({
      user: { id: user.id, username: user.username, role: user.role },
      token,
    });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    next(err);
  }
});

/**
 * POST /api/auth/login
 */
router.post('/auth/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }

    const user = getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    updateUserLogin(user.id);
    const token = generateToken(user);

    res.json({
      user: { id: user.id, username: user.username, role: user.role },
      token,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 * Get current user info (requires auth)
 */
router.get('/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

/**
 * GET /api/auth/status
 * Check if setup is complete (no auth required)
 */
router.get('/auth/status', (req, res) => {
  const userCount = countUsers();
  res.json({
    setupComplete: userCount > 0,
    userCount,
  });
});

/**
 * GET /api/auth/users
 * List users (admin only)
 */
router.get('/auth/users', requireAdmin, (req, res) => {
  const users = listUsers();
  res.json(users);
});

/**
 * POST /api/auth/users
 * Create a new user (admin only)
 */
router.post('/auth/users', requireAdmin, async (req, res, next) => {
  try {
    const { username, password, email, role = 'user' } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }

    const id = uuidv4().substring(0, 12);
    const passwordHash = await bcrypt.hash(password, 12);
    const user = createUser(id, username, email || null, passwordHash, role);

    res.status(201).json({
      id: user.id,
      username: user.username,
      role: user.role,
    });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    next(err);
  }
});

export default router;
