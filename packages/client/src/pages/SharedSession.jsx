import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as Y from 'yjs';
import api from '../services/api';
import { CollaborationProvider } from '../services/collaborationProvider';
import useCollaborationStore from '../store/collaborationStore';
import useWorkspaceStore from '../store/workspaceStore';
import useFileSystem from '../hooks/useFileSystem';
import WorkspaceLayout from '../components/Layout/WorkspaceLayout';
import { Loader2, AlertCircle } from 'lucide-react';
import './SharedSession.css';

export default function SharedSession() {
  const { token } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sessionInfo, setSessionInfo] = useState(null);
  
  const {
    setSessionInfo: setCollabSessionInfo,
    setCurrentUser,
    setConnectionStatus,
    addParticipant,
    removeParticipant,
    setYjsDoc,
    setAwareness,
    setProvider,
    leaveSession,
  } = useCollaborationStore();
  
  const setWorkspace = useWorkspaceStore(s => s.setWorkspace);
  
  // Initialize file system for the workspace
  const workspaceId = useWorkspaceStore(s => s.workspaceId) || 'local';
  const fileSystem = useFileSystem(workspaceId);

  useEffect(() => {
    console.log('[SharedSession] Initializing with token:', token);
    let provider = null;
    let doc = null;

    const initSession = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('[SharedSession] Fetching session info...');
        // Fetch session info
        const result = await api.getSessionByToken(token);
        console.log('[SharedSession] Session info received:', result);
        setSessionInfo(result.session);

        // Set workspace
        setWorkspace({
          id: result.session.workspaceId,
          name: result.session.workspaceName,
          path: '',
        });

        console.log('[SharedSession] Creating Yjs document...');
        // Create Yjs document
        doc = new Y.Doc();
        setYjsDoc(doc);

        // Get WebSocket URL — connect to backend
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // In dev mode (Vite), backend is on port 3001. In prod, same host/port.
        const port = window.location.port === '5173' ? '3001' : window.location.port;
        const wsUrl = `${protocol}//${window.location.hostname}${port ? `:${port}` : ''}`;

        console.log('[SharedSession] Connecting to WebSocket:', wsUrl);
        // Create collaboration provider
        provider = new CollaborationProvider(wsUrl, token, doc, {
          onStatusChange: (status) => {
            console.log('[SharedSession] Status changed:', status);
            setConnectionStatus(status);
          },
          onSessionInfo: (info) => {
            console.log('[SharedSession] Session info from WS:', info);
            setCollabSessionInfo({
              sessionId: info.sessionId,
              sessionToken: token,
              permission: info.permission,
              workspaceId: info.workspaceId,
            });
            setCurrentUser({
              clientId: info.clientId,
              username: info.username,
              participantId: info.participantId,
            });
            addParticipant({
              clientId: info.clientId,
              username: info.username,
              userId: info.userId || 'anonymous',
              permission: info.permission,
              joinedAt: Date.now(),
            });
          },
          onUserJoined: (user) => {
            console.log('[SharedSession] User joined:', user);
            addParticipant({
              ...user,
              joinedAt: Date.now(),
            });
          },
          onUserLeft: (user) => {
            console.log('[SharedSession] User left:', user);
            removeParticipant(user.clientId);
          },
          onError: (err) => {
            console.error('[SharedSession] Error:', err);
            setError(err);
          },
        });

        setProvider(provider);
        setAwareness(provider.awareness);
        
        console.log('[SharedSession] Initialization complete');
        setLoading(false);

      } catch (err) {
        console.error('[SharedSession] Failed to initialize:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    initSession();

    // Cleanup
    return () => {
      console.log('[SharedSession] Cleaning up...');
      if (provider) {
        provider.destroy();
      }
      if (doc) {
        doc.destroy();
      }
      leaveSession();
    };
  }, [token]);

  if (loading) {
    console.log('[SharedSession] Rendering loading state');
    return (
      <div className="shared-session-loading">
        <Loader2 size={48} className="spinner" />
        <p>Joining session...</p>
        <p style={{fontSize: '12px', opacity: 0.7}}>Token: {token?.substring(0, 20)}...</p>
      </div>
    );
  }

  if (error) {
    console.log('[SharedSession] Rendering error state:', error);
    return (
      <div className="shared-session-error">
        <AlertCircle size={48} />
        <h2>Failed to Join Session</h2>
        <p>{error}</p>
        <button onClick={() => navigate('/')}>Go Home</button>
      </div>
    );
  }

  console.log('[SharedSession] Rendering main UI');
  return (
    <WorkspaceLayout 
      fileSystem={fileSystem} 
      onLeaveSession={() => navigate('/')} 
    />
  );
}
