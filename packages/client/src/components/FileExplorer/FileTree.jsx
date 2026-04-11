import { useEffect, useState, useCallback } from 'react';
import FileNode from './FileNode';
import ContextMenu from './ContextMenu';
import './FileExplorer.css';

export default function FileTree({ fileSystem }) {
  const { fileTree, loading, error, expandedDirs, selectedPath, fetchFileTree, selectFile, toggleDir } = fileSystem;
  const [contextMenu, setContextMenu] = useState(null);

  useEffect(() => {
    fetchFileTree();
  }, [fetchFileTree]);

  const handleContextMenu = useCallback((e, node) => {
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  if (loading && !fileTree) {
    return <div className="file-tree-loading">Loading files...</div>;
  }

  if (error) {
    return (
      <div className="file-tree-error">
        <p>Error: {error}</p>
        <button 
          onClick={fetchFileTree} 
          style={{ 
            marginTop: '8px', 
            color: 'var(--text-link)', 
            textDecoration: 'underline',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 'var(--text-xs)',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!fileTree || !fileTree.children || fileTree.children.length === 0) {
    return (
      <div className="file-tree-loading">
        <span style={{ color: 'var(--text-tertiary)' }}>No files in workspace</span>
      </div>
    );
  }

  return (
    <div className="file-tree" role="tree">
      {sortNodes(fileTree.children).map(node => (
        <FileNode
          key={node.path}
          node={node}
          depth={0}
          expandedDirs={expandedDirs}
          selectedPath={selectedPath}
          onSelect={selectFile}
          onToggle={toggleDir}
          onContextMenu={handleContextMenu}
        />
      ))}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          node={contextMenu.node}
          onClose={handleCloseContextMenu}
          fileSystem={fileSystem}
        />
      )}
    </div>
  );
}

function sortNodes(nodes) {
  return [...nodes].sort((a, b) => {
    if (a.type === 'directory' && b.type !== 'directory') return -1;
    if (a.type !== 'directory' && b.type === 'directory') return 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}
