import { useEffect } from 'react';
import { FileCode2 } from 'lucide-react';
import useWorkspaceStore from '../../store/workspaceStore';
import useEditorStore from '../../store/editorStore';
import ActivityBar from '../Sidebar/ActivityBar';
import Sidebar from '../Sidebar/Sidebar';
import EditorTabs from '../Editor/EditorTabs';
import Breadcrumbs from '../Editor/Breadcrumbs';
import MonacoEditor from '../Editor/MonacoEditor';
import TerminalPanel from '../Terminal/TerminalPanel';
import StatusBar from '../StatusBar/StatusBar';
import SplitPane from './SplitPane';
import './Layout.css';

export default function WorkspaceLayout({ fileSystem }) {
  const sidebarVisible = useWorkspaceStore(s => s.sidebarVisible);
  const sidebarWidth = useWorkspaceStore(s => s.sidebarWidth);
  const terminalVisible = useWorkspaceStore(s => s.terminalVisible);
  const terminalHeight = useWorkspaceStore(s => s.terminalHeight);
  const setTerminalHeight = useWorkspaceStore(s => s.setTerminalHeight);

  const activeFile = useEditorStore(s => s.getActiveFile());
  const openFiles = useEditorStore(s => s.openFiles);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+S — Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        const file = useEditorStore.getState().getActiveFile();
        if (file && file.isDirty) {
          fileSystem.saveFile(file.path, file.content);
        }
      }

      // Ctrl+B — Toggle sidebar
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        useWorkspaceStore.getState().toggleSidebar();
      }

      // Ctrl+` — Toggle terminal
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        useWorkspaceStore.getState().toggleTerminal();
      }

      // Ctrl+Shift+I — Toggle AI
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        useWorkspaceStore.getState().setActiveSidebarPanel('ai');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fileSystem]);

  const editorContent = openFiles.length > 0 ? (
    <>
      <EditorTabs />
      {activeFile && <Breadcrumbs filePath={activeFile.path} />}
      <MonacoEditor fileSystem={fileSystem} />
    </>
  ) : (
    <EmptyState />
  );

  return (
    <div className="workspace-layout">
      {/* ── Row: ActivityBar + Sidebar + Main ── */}
      <div className="workspace-row">
        <ActivityBar />

        {sidebarVisible && (
          <div className="workspace-sidebar-wrapper" style={{ width: sidebarWidth }}>
            <Sidebar fileSystem={fileSystem} />
          </div>
        )}

        <div className="workspace-main">
          {terminalVisible ? (
            <SplitPane
              direction="vertical"
              initialSize={terminalHeight}
              minSize={100}
              maxSize={600}
              onResize={setTerminalHeight}
            >
              <div className="workspace-editor-area">
                {editorContent}
              </div>
              <TerminalPanel />
            </SplitPane>
          ) : (
            <div className="workspace-editor-area">
              {editorContent}
            </div>
          )}
        </div>
      </div>

      {/* ── Status Bar ── */}
      <StatusBar />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="editor-empty-state">
      <div className="editor-empty-logo"><FileCode2 size={48} /></div>
      <div className="editor-empty-title">Select a file to start editing</div>
      <div className="editor-empty-subtitle">Open a file from the explorer or use the shortcuts below</div>
      <div className="editor-empty-shortcuts">
        <div className="editor-empty-shortcut">
          <kbd>Ctrl+B</kbd>
          <span>Toggle Sidebar</span>
        </div>
        <div className="editor-empty-shortcut">
          <kbd>Ctrl+`</kbd>
          <span>Toggle Terminal</span>
        </div>
        <div className="editor-empty-shortcut">
          <kbd>Ctrl+Shift+I</kbd>
          <span>Toggle AI Assistant</span>
        </div>
      </div>
    </div>
  );
}
