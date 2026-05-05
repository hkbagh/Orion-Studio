import {
  getSharedSessionById,
  getSharedSessionByToken,
  isSessionExpired,
  getParticipantBySessionAndUser,
} from '../db/collaborationQueries.js';

/**
 * Middleware: Validate session exists and is active
 */
export function validateSession(req, res, next) {
  try {
    const sessionId = req.params.sessionId || req.body.sessionId;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const session = getSharedSessionById(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (!session.is_active) {
      return res.status(410).json({ error: 'Session is no longer active' });
    }

    if (isSessionExpired(session)) {
      return res.status(410).json({ error: 'Session has expired' });
    }

    // Attach session to request
    req.session = session;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware: Validate user has required permission
 */
export function validatePermission(requiredPermission) {
  return (req, res, next) => {
    try {
      const session = req.session;
      
      if (!session) {
        return res.status(400).json({ error: 'Session not validated' });
      }

      const permissions = {
        viewer: 1,
        editor: 2,
        admin: 3,
      };

      const userPermission = permissions[session.permission] || 0;
      const required = permissions[requiredPermission] || 0;

      if (userPermission < required) {
        return res.status(403).json({ 
          error: `${requiredPermission} permission required`,
          currentPermission: session.permission,
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Middleware: Validate user is session owner
 */
export function requireSessionOwner(req, res, next) {
  try {
    const session = req.session;
    
    if (!session) {
      return res.status(400).json({ error: 'Session not validated' });
    }

    if (session.owner_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only the session owner can perform this action' });
    }

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Helper: Check if user can edit in session
 */
export function canEdit(session) {
  return session.permission === 'editor' || session.permission === 'admin';
}

/**
 * Helper: Check if user can manage session
 */
export function canManage(session, userId) {
  return session.owner_id === userId || session.permission === 'admin';
}
