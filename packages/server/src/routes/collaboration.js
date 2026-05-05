import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import os from 'os';
import { requireAuth } from '../middleware/auth.js';
import { validateSession, validatePermission } from '../middleware/collaborationAuth.js';
import {
  createSharedSession,
  getSharedSessionById,
  getSharedSessionByToken,
  getSharedSessionsByWorkspace,
  getSharedSessionsByOwner,
  deactivateSession,
  deleteSession,
  isSessionExpired,
  getParticipantsBySession,
  getSessionActivity,
  cleanupExpiredSessions,
} from '../db/collaborationQueries.js';
import { getWorkspaceById } from '../db/database.js';
import collaborationService from '../services/collaborationService.js';

const router = Router();

// ══════════════════════════════════════════════════════════════
// SHARE SESSION MANAGEMENT
// ══════════════════════════════════════════════════════════════

/**
 * POST /api/collab/share
 * Create a new shareable session
 */
router.post('/collab/share', requireAuth, async (req, res, next) => {
  try {
    const {
      workspaceId,
      permission = 'editor',
      visibility = 'private',
      expiresIn = null,
      maxUsers = 10,
    } = req.body;

    if (!workspaceId) {
      return res.status(400).json({ error: 'workspaceId is required' });
    }

    if (!['viewer', 'editor', 'admin'].includes(permission)) {
      return res.status(400).json({ error: 'Invalid permission. Must be viewer, editor, or admin' });
    }

    if (!['public', 'private'].includes(visibility)) {
      return res.status(400).json({ error: 'Invalid visibility. Must be public or private' });
    }

    // Resolve workspace ID - 'local' maps to 'default'
    const resolvedWorkspaceId = workspaceId === 'local' ? 'default' : workspaceId;

    // Check if workspace exists
    const workspace = getWorkspaceById(resolvedWorkspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Handle dev mode - use NULL for owner_id if dev user
    const ownerId = req.user.id === 'dev' ? null : req.user.id;

    // Generate secure share token
    const shareToken = crypto.randomBytes(32).toString('base64url');
    const sessionId = uuidv4();

    // Calculate expiry
    let expiresAt = null;
    if (expiresIn && expiresIn > 0) {
      const expiry = new Date();
      expiry.setHours(expiry.getHours() + expiresIn);
      expiresAt = expiry.toISOString();
    }

    // Create session
    const session = createSharedSession(
      sessionId,
      resolvedWorkspaceId,
      ownerId,
      shareToken,
      permission,
      visibility,
      expiresAt,
      maxUsers
    );

    // Get LAN IP for shareable link
    let localIp = 'localhost';
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          localIp = iface.address;
          break;
        }
      }
      if (localIp !== 'localhost') break;
    }

    // Generate shareable link
    const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, '') || `${req.protocol}://${req.headers.host}`;
    let frontendUrl = process.env.FRONTEND_URL || origin.replace(':3001', ':5173');
    frontendUrl = frontendUrl.replace('localhost', localIp).replace('127.0.0.1', localIp);
    
    const shareUrl = `${frontendUrl}/session/${shareToken}`;

    res.status(201).json({
      session: {
        id: session.id,
        workspaceId: session.workspace_id,
        permission: session.permission,
        visibility: session.visibility,
        expiresAt: session.expires_at,
        maxUsers: session.max_users,
        shareToken: session.share_token,
        shareUrl,
        createdAt: session.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/collab/session/:token
 * Get session info by share token (public endpoint)
 */
router.get('/collab/session/:token', async (req, res, next) => {
  try {
    const { token } = req.params;

    const session = getSharedSessionByToken(token);
    if (!session) {
      return res.status(404).json({ error: 'Session not found or inactive' });
    }

    if (isSessionExpired(session)) {
      return res.status(410).json({ error: 'Session has expired' });
    }

    const resolvedWorkspaceId = session.workspace_id === 'local' ? 'default' : session.workspace_id;
    const workspace = getWorkspaceById(resolvedWorkspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const participants = getParticipantsBySession(session.id);

    res.json({
      session: {
        id: session.id,
        workspaceId: session.workspace_id,
        workspaceName: workspace.name,
        permission: session.permission,
        visibility: session.visibility,
        expiresAt: session.expires_at,
        maxUsers: session.max_users,
        activeUsers: participants.length,
        createdAt: session.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/collab/sessions/workspace/:workspaceId
 * List all sessions for a workspace
 */
router.get('/collab/sessions/workspace/:workspaceId', requireAuth, async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const resolvedWorkspaceId = workspaceId === 'local' ? 'default' : workspaceId;

    const sessions = getSharedSessionsByWorkspace(resolvedWorkspaceId);

    const enriched = sessions.map(session => {
      const participants = getParticipantsBySession(session.id);
      return {
        ...session,
        activeUsers: participants.length,
        isExpired: isSessionExpired(session),
      };
    });

    res.json({ sessions: enriched });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/collab/sessions/my
 * List all sessions owned by current user
 */
router.get('/collab/sessions/my', requireAuth, async (req, res, next) => {
  try {
    const sessions = getSharedSessionsByOwner(req.user.id);

    const enriched = sessions.map(session => {
      const participants = getParticipantsBySession(session.id);
      const resolvedWorkspaceId = session.workspace_id === 'local' ? 'default' : session.workspace_id;
      const workspace = getWorkspaceById(resolvedWorkspaceId);
      return {
        ...session,
        workspaceName: workspace?.name,
        activeUsers: participants.length,
        isExpired: isSessionExpired(session),
      };
    });

    res.json({ sessions: enriched });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/collab/session/:sessionId
 * Revoke/delete a session (owner only)
 */
router.delete('/collab/session/:sessionId', requireAuth, async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    const session = getSharedSessionById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.owner_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only the session owner can delete it' });
    }

    deactivateSession(sessionId);

    res.json({ message: 'Session revoked successfully' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/collab/session/:sessionId/participants
 * Get participants in a session
 */
router.get('/collab/session/:sessionId/participants', requireAuth, validateSession, async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const participants = getParticipantsBySession(sessionId);
    res.json({ participants });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/collab/session/:sessionId/activity
 * Get activity log for a session
 */
router.get('/collab/session/:sessionId/activity', requireAuth, validateSession, async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    const activity = getSessionActivity(sessionId, limit);
    res.json({ activity });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/collab/active
 * Get all active collaboration sessions
 */
router.get('/collab/active', requireAuth, async (req, res, next) => {
  try {
    const activeSessions = collaborationService.getActiveSessions();
    res.json({ sessions: activeSessions });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/collab/cleanup
 * Cleanup expired sessions
 */
router.post('/collab/cleanup', requireAuth, async (req, res, next) => {
  try {
    const cleaned = cleanupExpiredSessions();
    res.json({ message: `Cleaned up ${cleaned} expired sessions` });
  } catch (err) {
    next(err);
  }
});

export default router;
