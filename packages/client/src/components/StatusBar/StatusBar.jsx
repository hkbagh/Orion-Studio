import { GitBranch } from 'lucide-react';
import useWorkspaceStore from '../../store/workspaceStore';
import useEditorStore from '../../store/editorStore';
import './StatusBar.css';

export default function StatusBar() {
  const connectionStatus = useWorkspaceStore(s => s.connectionStatus);
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
      </div>

      <div className="status-bar-right">
        {activeFile && (
          <>
            {/* Language */}
            <div className="status-bar-item clickable">
              {activeFile.language}
            </div>

            {/* Encoding */}
            <div className="status-bar-item">
              UTF-8
            </div>

            {/* Indentation */}
            <div className="status-bar-item clickable">
              Spaces: 2
            </div>
          </>
        )}

        {/* Branding */}
        <div className="status-bar-item" style={{ color: 'var(--accent-primary)' }}>
          ✦ Orion Studio
        </div>
      </div>
    </div>
  );
}
