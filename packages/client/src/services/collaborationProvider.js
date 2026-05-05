import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const MESSAGE_QUERY_AWARENESS = 2;

/**
 * WebSocket provider for Yjs collaboration
 * Connects to the backend collaboration WebSocket
 */
export class CollaborationProvider {
  constructor(serverUrl, shareToken, doc, options = {}) {
    this.serverUrl = serverUrl;
    this.shareToken = shareToken;
    this.doc = doc;
    this.awareness = new awarenessProtocol.Awareness(doc);
    
    this.ws = null;
    this.connected = false;
    this.synced = false;
    
    this.onStatusChange = options.onStatusChange || (() => {});
    this.onSessionInfo = options.onSessionInfo || (() => {});
    this.onUserJoined = options.onUserJoined || (() => {});
    this.onUserLeft = options.onUserLeft || (() => {});
    this.onError = options.onError || (() => {});
    
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    
    this._connect();
    this._setupAwareness();
  }

  _connect() {
    const wsUrl = `${this.serverUrl}/ws/collab?token=${this.shareToken}`;
    
    this.onStatusChange('connecting');
    
    try {
      this.ws = new WebSocket(wsUrl);
      this.ws.binaryType = 'arraybuffer';
      
      this.ws.onopen = () => {
        console.log('[Collab Provider] Connected');
        this.connected = true;
        this.reconnectAttempts = 0;
        this.onStatusChange('connected');
        
        this._sendSyncStep1();
        this._queryAwareness();
      };
      
      this.ws.onmessage = (event) => {
        this._handleMessage(event.data);
      };
      
      this.ws.onclose = () => {
        console.log('[Collab Provider] Disconnected');
        this.connected = false;
        this.synced = false;
        this.onStatusChange('disconnected');
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
          console.log(`[Collab Provider] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
          setTimeout(() => this._connect(), delay);
        } else {
          this.onError('Failed to reconnect after multiple attempts');
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('[Collab Provider] WebSocket error:', error);
        this.onError('WebSocket connection error');
      };
      
    } catch (err) {
      console.error('[Collab Provider] Failed to connect:', err);
      this.onError(err.message);
    }
  }

  _handleMessage(data) {
    try {
      // Try to parse as JSON (control messages)
      if (typeof data === 'string' || data instanceof ArrayBuffer && data.byteLength > 0 && new Uint8Array(data)[0] === 123) {
        const message = JSON.parse(typeof data === 'string' ? data : new TextDecoder().decode(data));
        this._handleControlMessage(message);
        return;
      }
      
      // Binary Yjs message
      const uint8Array = new Uint8Array(data);
      const decoder = decoding.createDecoder(uint8Array);
      const messageType = decoding.readVarUint(decoder);
      
      switch (messageType) {
        case MESSAGE_SYNC:
          this._handleSyncMessage(uint8Array.slice(1));
          break;
        case MESSAGE_AWARENESS:
          this._handleAwarenessMessage(uint8Array.slice(1));
          break;
      }
    } catch (err) {
      console.error('[Collab Provider] Message handling error:', err);
    }
  }

  _handleControlMessage(message) {
    switch (message.type) {
      case 'session-info':
        this.onSessionInfo(message.data);
        break;
      case 'user-joined':
        this.onUserJoined(message.user);
        break;
      case 'user-left':
        this.onUserLeft(message.user);
        break;
      case 'error':
        this.onError(message.message);
        break;
    }
  }

  _handleSyncMessage(data) {
    const decoder = decoding.createDecoder(data);
    const encoder = encoding.createEncoder();
    
    const syncMessageType = decoding.readVarUint(decoder);
    
    switch (syncMessageType) {
      case 0: // Sync step 1
        encoding.writeVarUint(encoder, MESSAGE_SYNC);
        syncProtocol.readSyncStep1(decoder, encoder, this.doc);
        this._send(encoding.toUint8Array(encoder));
        break;
      case 1: // Sync step 2
        syncProtocol.readSyncStep2(decoder, this.doc);
        this.synced = true;
        break;
      case 2: // Update
        Y.applyUpdate(this.doc, decoding.readVarUint8Array(decoder));
        break;
    }
  }

  _handleAwarenessMessage(data) {
    awarenessProtocol.applyAwarenessUpdate(this.awareness, data, null);
  }

  _sendSyncStep1() {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(encoder, this.doc);
    this._send(encoding.toUint8Array(encoder));
  }

  _queryAwareness() {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_QUERY_AWARENESS);
    this._send(encoding.toUint8Array(encoder));
  }

  _setupAwareness() {
    this.awareness.on('update', ({ added, updated, removed }) => {
      const changedClients = added.concat(updated).concat(removed);
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
      awarenessProtocol.encodeAwarenessUpdate(encoder, this.awareness, changedClients);
      this._send(encoding.toUint8Array(encoder));
    });
    
    this.doc.on('update', (update, origin) => {
      if (origin !== this) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_SYNC);
        encoding.writeVarUint(encoder, 2); // Update message
        encoding.writeVarUint8Array(encoder, update);
        this._send(encoding.toUint8Array(encoder));
      }
    });
  }

  _send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  sendControlMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  setAwarenessField(field, value) {
    const currentState = this.awareness.getLocalState() || {};
    this.awareness.setLocalState({
      ...currentState,
      [field]: value,
    });
  }

  destroy() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.awareness.destroy();
    this.connected = false;
    this.synced = false;
  }
}
