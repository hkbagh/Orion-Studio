import { v4 as uuidv4 } from 'uuid';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import collaborationService from '../services/collaborationService.js';
import { authenticateWebSocket } from '../middleware/auth.js';
import {
  getSharedSessionByToken,
  isSessionExpired,
  countActiveParticipants,
} from '../db/collaborationQueries.js';

// ══════════════════════════════════════════════════════════════
// COLLABORATION WEBSOCKET HANDLER
// Handles real-time collaboration via Yjs protocol
// ══════════════════════════════════════════════════════════════

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const MESSAGE_QUERY_AWARENESS = 2;

/**
 * Setup collaboration WebSocket handler
 */
export default function setupCollaborationHandler(wss) {
  wss.on('connection', async (ws, request) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    
    // Only handle collaboration connections
    if (!url.pathname.startsWith('/ws/collab')) return;

    const shareToken = url.searchParams.get('token');
    const clientId = uuidv4();

    console.log(`[Collab WS] New connection attempt with token: ${shareToken?.substring(0, 8)}...`);

    try {
      // Validate session token
      if (!shareToken) {
        ws.send(JSON.stringify({ type: 'error', message: 'Missing share token' }));
        ws.close();
        return;
      }

      const session = getSharedSessionByToken(shareToken);
      if (!session) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid or expired session' }));
        ws.close();
        return;
      }

      if (isSessionExpired(session)) {
        ws.send(JSON.stringify({ type: 'error', message: 'Session has expired' }));
        ws.close();
        return;
      }

      // Check max users limit
      const activeCount = countActiveParticipants(session.id);
      if (activeCount >= session.max_users) {
        ws.send(JSON.stringify({ type: 'error', message: 'Session is full' }));
        ws.close();
        return;
      }

      // Authenticate user (optional - can be anonymous)
      const user = authenticateWebSocket(request);
      const userId = user?.id || 'anonymous';
      const username = user?.username || `Guest-${clientId.substring(0, 6)}`;

      // Add client to collaboration service
      const { session: collabSession, participantId } = await collaborationService.addClient(
        clientId,
        ws,
        session.id,
        userId,
        username,
        session.permission
      );

      // Send initial sync
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      const syncMessage = encoding.toUint8Array(encoder);
      ws.send(syncMessage);

      // Send session info
      ws.send(JSON.stringify({
        type: 'session-info',
        data: {
          sessionId: session.id,
          workspaceId: session.workspace_id,
          permission: session.permission,
          clientId,
          participantId,
          username,
        },
      }));

      // Broadcast user joined to other clients
      broadcastPresence(session.id, {
        type: 'user-joined',
        user: { clientId, username, userId, permission: session.permission },
      }, clientId);

      // Handle messages
      ws.on('message', async (data) => {
        try {
          // Try to parse as JSON first (for control messages)
          if (data[0] === 123) { // '{' character
            const message = JSON.parse(data.toString());
            handleControlMessage(clientId, session.id, message);
            return;
          }

          // Otherwise, treat as binary Yjs message
          const decoder = decoding.createDecoder(new Uint8Array(data));
          const messageType = decoding.readVarUint(decoder);

          switch (messageType) {
            case MESSAGE_SYNC: {
              const response = collaborationService.handleSyncMessage(
                clientId,
                new Uint8Array(data)
              );
              
              if (response) {
                ws.send(response);
              }

              // Broadcast to other clients
              collaborationService.broadcastToSession(
                session.id,
                data,
                clientId
              );
              break;
            }

            case MESSAGE_AWARENESS: {
              collaborationService.handleAwarenessMessage(
                clientId,
                new Uint8Array(data)
              );
              
              collaborationService.broadcastToSession(
                session.id,
                data,
                clientId
              );
              break;
            }

            case MESSAGE_QUERY_AWARENESS: {
              const collabSession = collaborationService.sessions.get(session.id);
              if (collabSession) {
                const awarenessStates = collabSession.awareness.getStates();
                const encoder = encoding.createEncoder();
                encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
                encoding.writeVarUint(encoder, awarenessStates.size);
                awarenessStates.forEach((state, clientId) => {
                  encoding.writeVarUint(encoder, clientId);
                  encoding.writeVarString(encoder, JSON.stringify(state));
                });
                ws.send(encoding.toUint8Array(encoder));
              }
              break;
            }
          }
        } catch (err) {
          console.error('[Collab WS] Message handling error:', err);
        }
      });

      // Handle disconnect
      ws.on('close', () => {
        console.log(`[Collab WS] Client ${username} disconnected`);
        collaborationService.removeClient(clientId);
        
        broadcastPresence(session.id, {
          type: 'user-left',
          user: { clientId, username },
        });
      });

      ws.on('error', (err) => {
        console.error('[Collab WS] WebSocket error:', err);
      });

    } catch (err) {
      console.error('[Collab WS] Setup error:', err);
      ws.send(JSON.stringify({ type: 'error', message: 'Failed to join session' }));
      ws.close();
    }
  });
}

/**
 * Handle control messages (JSON)
 */
function handleControlMessage(clientId, sessionId, message) {
  switch (message.type) {
    case 'cursor-position':
      broadcastPresence(sessionId, {
        type: 'cursor-update',
        clientId,
        position: message.position,
      }, clientId);
      break;

    case 'file-opened':
      broadcastPresence(sessionId, {
        type: 'file-opened',
        clientId,
        filePath: message.filePath,
      }, clientId);
      break;

    default:
      console.warn(`[Collab WS] Unknown control message type: ${message.type}`);
  }
}

/**
 * Broadcast presence/control message to session
 */
function broadcastPresence(sessionId, message, excludeClientId = null) {
  const data = JSON.stringify(message);
  collaborationService.broadcastToSession(sessionId, data, excludeClientId);
}
