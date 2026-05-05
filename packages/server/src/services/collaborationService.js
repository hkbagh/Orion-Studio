import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import { encoding, decoding } from 'lib0';
import { v4 as uuidv4 } from 'uuid';
import {
  getSharedSessionById,
  updateSessionLastAccessed,
  addParticipant,
  getParticipantsBySession,
  updateParticipantLastSeen,
  removeParticipant,
  logActivity,
  countActiveParticipants,
} from '../db/collaborationQueries.js';

// ══════════════════════════════════════════════════════════════
// COLLABORATION SERVICE
// Manages Yjs documents and awareness for real-time collaboration
// ══════════════════════════════════════════════════════════════

class CollaborationService {
  constructor() {
    // sessionId -> { doc: Y.Doc, awareness: Awareness, clients: Set<clientId> }
    this.sessions = new Map();
    
    // clientId -> { sessionId, socket, userId, username, permission, participantId }
    this.clients = new Map();
    
    // Cleanup interval
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Get or create a Yjs document for a session
   */
  getOrCreateSession(sessionId) {
    if (this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId);
    }

    const doc = new Y.Doc();
    const awareness = new awarenessProtocol.Awareness(doc);
    
    const session = {
      doc,
      awareness,
      clients: new Set(),
      lastActivity: Date.now(),
    };

    this.sessions.set(sessionId, session);
    console.log(`[Collab] Created session: ${sessionId}`);
    
    return session;
  }

  /**
   * Add a client to a session
   */
  async addClient(clientId, socket, sessionId, userId, username, permission) {
    const session = this.getOrCreateSession(sessionId);
    
    // Add participant to database
    const participantId = uuidv4();
    const isAnonymous = !userId || userId === 'anonymous';
    
    try {
      addParticipant(participantId, sessionId, userId, username, permission, isAnonymous);
      
      logActivity(uuidv4(), sessionId, userId, username, 'joined', null, {
        clientId,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[Collab] Failed to add participant:', err);
    }

    // Store client info
    this.clients.set(clientId, {
      sessionId,
      socket,
      userId,
      username,
      permission,
      participantId,
      joinedAt: Date.now(),
    });

    session.clients.add(clientId);
    session.lastActivity = Date.now();

    updateSessionLastAccessed(sessionId);

    console.log(`[Collab] Client ${username} joined session ${sessionId} (${session.clients.size} clients)`);

    return { session, participantId };
  }

  /**
   * Remove a client from a session
   */
  removeClient(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { sessionId, username, userId, participantId } = client;
    const session = this.sessions.get(sessionId);

    if (session) {
      session.clients.delete(clientId);
      session.lastActivity = Date.now();

      awarenessProtocol.removeAwarenessStates(
        session.awareness,
        [clientId],
        null
      );

      console.log(`[Collab] Client ${username} left session ${sessionId} (${session.clients.size} clients)`);

      if (session.clients.size === 0) {
        console.log(`[Collab] Session ${sessionId} is now empty`);
      }
    }

    // Remove participant from database
    try {
      if (participantId) {
        removeParticipant(participantId);
      }
      
      logActivity(uuidv4(), sessionId, userId, username, 'left', null, {
        clientId,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[Collab] Failed to remove participant:', err);
    }

    this.clients.delete(clientId);
  }

  /**
   * Handle sync message from client
   */
  handleSyncMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const session = this.sessions.get(client.sessionId);
    if (!session) return;

    const decoder = decoding.createDecoder(message);
    const encoder = encoding.createEncoder();
    
    // Read and skip the MESSAGE_SYNC byte (0)
    decoding.readVarUint(decoder);
    
    const messageType = decoding.readVarUint(decoder);

    switch (messageType) {
      case syncProtocol.messageYjsSyncStep1:
        encoding.writeVarUint(encoder, 0); // MESSAGE_SYNC
        syncProtocol.readSyncStep1(decoder, encoder, session.doc);
        break;
      case syncProtocol.messageYjsSyncStep2:
        syncProtocol.readSyncStep2(decoder, session.doc);
        break;
      case syncProtocol.messageYjsUpdate:
        if (client.permission === 'viewer') {
          console.warn(`[Collab] Viewer ${client.username} attempted to edit`);
          return null;
        }
        syncProtocol.readUpdate(decoder, session.doc);
        session.lastActivity = Date.now();
        updateParticipantLastSeen(client.participantId);
        break;
    }

    const response = encoding.toUint8Array(encoder);
    return response.length > 1 ? response : null;
  }

  /**
   * Handle awareness message from client
   */
  handleAwarenessMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const session = this.sessions.get(client.sessionId);
    if (!session) return;

    const decoder = decoding.createDecoder(message);
    decoding.readVarUint(decoder); // Skip MESSAGE_AWARENESS
    
    const update = decoding.readVarUint8Array(decoder);

    awarenessProtocol.applyAwarenessUpdate(
      session.awareness,
      update,
      null
    );
  }

  /**
   * Broadcast message to all clients in a session except sender
   */
  broadcastToSession(sessionId, message, excludeClientId = null) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    for (const clientId of session.clients) {
      if (clientId === excludeClientId) continue;
      
      const client = this.clients.get(clientId);
      if (client && client.socket.readyState === 1) { // WebSocket.OPEN
        try {
          client.socket.send(message);
        } catch (err) {
          console.error(`[Collab] Failed to send to client ${clientId}:`, err);
        }
      }
    }
  }

  /**
   * Get session info
   */
  getSessionInfo(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const clients = Array.from(session.clients).map(clientId => {
      const client = this.clients.get(clientId);
      return client ? {
        clientId,
        username: client.username,
        userId: client.userId,
        permission: client.permission,
        joinedAt: client.joinedAt,
      } : null;
    }).filter(Boolean);

    return {
      sessionId,
      clientCount: session.clients.size,
      clients,
      lastActivity: session.lastActivity,
    };
  }

  /**
   * Get all active sessions
   */
  getActiveSessions() {
    return Array.from(this.sessions.keys()).map(sessionId => 
      this.getSessionInfo(sessionId)
    );
  }

  /**
   * Cleanup inactive sessions
   */
  cleanup() {
    const now = Date.now();
    const INACTIVE_TIMEOUT = 30 * 60 * 1000; // 30 minutes

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.clients.size === 0 && now - session.lastActivity > INACTIVE_TIMEOUT) {
        console.log(`[Collab] Cleaning up inactive session: ${sessionId}`);
        session.doc.destroy();
        this.sessions.delete(sessionId);
      }
    }
  }

  /**
   * Destroy the service
   */
  destroy() {
    clearInterval(this.cleanupInterval);
    
    for (const [sessionId, session] of this.sessions.entries()) {
      session.doc.destroy();
    }
    
    this.sessions.clear();
    this.clients.clear();
  }
}

// Singleton instance
const collaborationService = new CollaborationService();

export default collaborationService;
