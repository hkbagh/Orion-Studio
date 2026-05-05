import { GitBranch, Sparkles } from 'lucide-react';
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
