import { useCallback } from 'react';
import useFileSystem from './hooks/useFileSystem';
import useFileWatcher from './hooks/useFileWatcher';
import WorkspaceLayout from './components/Layout/WorkspaceLayout';

function App() {
  const fileSystem = useFileSystem('local');

  // Auto-refresh file tree on external file changes
  const handleFileChange = useCallback((event) => {
    // Debounce: only refresh if it's a structural change
    if (['file_added', 'file_deleted', 'dir_added', 'dir_deleted'].includes(event.type)) {
      fileSystem.fetchFileTree();
    }
  }, [fileSystem.fetchFileTree]);

  useFileWatcher('local', handleFileChange);

  return <WorkspaceLayout fileSystem={fileSystem} />;
}

export default App;
