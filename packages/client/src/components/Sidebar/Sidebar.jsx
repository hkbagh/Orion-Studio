import { FilePlus, FolderPlus, RefreshCw } from 'lucide-react';
import useWorkspaceStore from '../../store/workspaceStore';
import FileTree from '../FileExplorer/FileTree';
import SearchPanel from './SearchPanel';
import AIChat from '../AI/AIChat';
import './Sidebar.css';

export default function Sidebar({ fileSystem }) {
  const activePanel = useWorkspaceStore(s => s.activeSidebarPanel);

  return (
    <div className="sidebar">
      {activePanel === 'files' && (
        <>
          <div className="sidebar-header">
            <span className="sidebar-title">Explorer</span>
            <div className="sidebar-actions">
              <button
                className="sidebar-action-btn"
                onClick={() => {
                  const name = prompt('File name:');
                  if (name) fileSystem.createFileOrDir('', name, false);
                }}
                title="New File"
              >
                <FilePlus size={16} />
              </button>
              <button
                className="sidebar-action-btn"
                onClick={() => {
                  const name = prompt('Folder name:');
                  if (name) fileSystem.createFileOrDir('', name, true);
                }}
                title="New Folder"
              >
                <FolderPlus size={16} />
              </button>
              <button
                className="sidebar-action-btn"
                onClick={fileSystem.fetchFileTree}
                title="Refresh"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </div>
          <div className="sidebar-content">
            <FileTree fileSystem={fileSystem} />
          </div>
        </>
      )}

      {activePanel === 'search' && (
        <SearchPanel />
      )}

      {activePanel === 'ai' && (
        <AIChat fileSystem={fileSystem} />
      )}

      {activePanel === 'settings' && (
        <>
          <div className="sidebar-header">
            <span className="sidebar-title">Settings</span>
          </div>
          <div className="sidebar-content" style={{ 
            padding: 'var(--space-md)',
            color: 'var(--text-tertiary)',
            fontSize: 'var(--text-xs)',
            textAlign: 'center',
          }}>
            <p>Settings coming soon</p>
          </div>
        </>
      )}
    </div>
  );
}
