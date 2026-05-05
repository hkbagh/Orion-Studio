import { Play, Terminal, GitBranch, Sparkles } from 'lucide-react';
import useWorkspaceStore from '../../store/workspaceStore';
import useEditorStore from '../../store/editorStore';
import './StatusBar.css';

export default function StatusBar() {
  const connectionStatus = useWorkspaceStore(s => s.connectionStatus);
  const terminalVisible = useWorkspaceStore(s => s.terminalVisible);
  const toggleTerminal = useWorkspaceStore(s => s.toggleTerminal);
  const activeFile = useEditorStore(s => s.getActiveFile());

  return (
    <div className="status-bar">
      <div className="status-bar-left">
        {/* Connection status */}
        <div className="status-bar-item">
          <span className={`status-bar-dot ${connectionStatus}`} />
          <span>{connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}</span>
        </div>

        {/* Git branch */}
        <div className="status-bar-item">
          <GitBranch size={12} />
          <span className="status-bar-branch">main</span>
        </div>

        {/* Terminal toggle */}
        <button
          className={`status-bar-btn ${terminalVisible ? 'active' : ''}`}
          onClick={toggleTerminal}
          title={terminalVisible ? 'Hide Terminal (Ctrl+`)' : 'Show Terminal (Ctrl+`)'}
        >
          <Terminal size={13} />
          <span>Terminal</span>
        </button>
      </div>

      <div className="status-bar-right">
        {activeFile && (
          <>
            {/* Encoding */}
            <div className="status-bar-item">
              UTF-8
            </div>

            {/* Language */}
            <div className="status-bar-item clickable">
              {activeFile.language}
            </div>
          </>
        )}

        {/* AI Status */}
        <div className="status-bar-item status-bar-ai">
          <Sparkles size={10} />
          <span>Orion AI Ready</span>
        </div>
      </div>
    </div>
  );
}
