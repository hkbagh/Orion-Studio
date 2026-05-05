import { getDatabase } from './database.js';

// ══════════════════════════════════════════════════════════════
// SHARED SESSION QUERIES
// ══════════════════════════════════════════════════════════════

export function createSharedSession(id, workspaceId, ownerId, shareToken, permission, visibility, expiresAt, maxUsers = 10) {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO shared_sessions (id, workspace_id, owner_id, share_token, permission, visibility, expires_at, max_users)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, workspaceId, ownerId, shareToken, permission, visibility, expiresAt, maxUsers);
  return getSharedSessionById(id);
}

export function getSharedSessionById(id) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM shared_sessions WHERE id = ?').get(id);
}

export function getSharedSessionByToken(token) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM shared_sessions WHERE share_token = ? AND is_active = 1').get(token);
}

export function getSharedSessionsByWorkspace(workspaceId) {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM shared_sessions 
    WHERE workspace_id = ? AND is_active = 1 
    ORDER BY created_at DESC
  `).all(workspaceId);
}

export function getSharedSessionsByOwner(ownerId) {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM shared_sessions 
    WHERE owner_id = ? AND is_active = 1 
    ORDER BY created_at DESC
  `).all(ownerId);
}

export function updateSessionLastAccessed(id) {
  const db = getDatabase();
  db.prepare(`
    UPDATE shared_sessions 
    SET last_accessed_at = datetime('now') 
    WHERE id = ?
  `).run(id);
}

export function deactivateSession(id) {
  const db = getDatabase();
  db.prepare('UPDATE shared_sessions SET is_active = 0 WHERE id = ?').run(id);
}

export function deleteSession(id) {
  const db = getDatabase();
  db.prepare('DELETE FROM shared_sessions WHERE id = ?').run(id);
}

export function isSessionExpired(session) {
  if (!session.expires_at) return false;
  return new Date(session.expires_at) < new Date();
}

export function cleanupExpiredSessions() {
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE shared_sessions 
    SET is_active = 0 
    WHERE expires_at IS NOT NULL 
    AND datetime(expires_at) < datetime('now')
    AND is_active = 1
  `);
  const result = stmt.run();
  return result.changes;
}

// ══════════════════════════════════════════════════════════════
// SESSION PARTICIPANT QUERIES
// ══════════════════════════════════════════════════════════════

export function addParticipant(id, sessionId, userId, username, permission, isAnonymous = false) {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO session_participants (id, session_id, user_id, username, permission, is_anonymous)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, sessionId, userId, username, permission, isAnonymous);
  return getParticipantById(id);
}

export function getParticipantById(id) {
  const db = getDatabase();
  return db.prepare('SELECT * FROM session_participants WHERE id = ?').get(id);
}

export function getParticipantsBySession(sessionId) {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM session_participants 
    WHERE session_id = ? 
    ORDER BY joined_at ASC
  `).all(sessionId);
}

export function getParticipantBySessionAndUser(sessionId, userId) {
  const db = getDatabase();
  return db.prepare(`
    SELECT * FROM session_participants 
    WHERE session_id = ? AND user_id = ?
  `).get(sessionId, userId);
}

export function updateParticipantLastSeen(id) {
  const db = getDatabase();
  db.prepare(`
    UPDATE session_participants 
    SET last_seen_at = datetime('now') 
    WHERE id = ?
  `).run(id);
}

export function removeParticipant(id) {
  const db = getDatabase();
  db.prepare('DELETE FROM session_participants WHERE id = ?').run(id);
}

export function countActiveParticipants(sessionId) {
  const db = getDatabase();
  const result = db.prepare(`
    SELECT COUNT(*) as count 
    FROM session_participants 
    WHERE session_id = ?
  `).get(sessionId);
  return result.count;
}

// ══════════════════════════════════════════════════════════════
// SESSION ACTIVITY QUERIES
// ══════════════════════════════════════════════════════════════

export function logActivity(id, sessionId, userId, username, action, filePath = null, metadata = null) {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO session_activity (id, session_id, user_id, username, action, file_path, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, sessionId, userId, username, action, filePath, metadata ? JSON.stringify(metadata) : null);
}

export function getSessionActivity(sessionId, limit = 100) {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM session_activity 
    WHERE session_id = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `).all(sessionId, limit);
  
  return rows.map(row => ({
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
  }));
}

export function cleanupOldActivity(daysToKeep = 30) {
  const db = getDatabase();
  const stmt = db.prepare(`
    DELETE FROM session_activity 
    WHERE datetime(created_at) < datetime('now', '-' || ? || ' days')
  `);
  const result = stmt.run(daysToKeep);
  return result.changes;
}
