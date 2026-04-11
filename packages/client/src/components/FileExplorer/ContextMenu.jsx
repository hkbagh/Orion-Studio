import { useState, useCallback } from 'react';
import { FilePlus, FolderPlus, Pencil, Trash2, Copy } from 'lucide-react';

export default function ContextMenu({ x, y, node, onClose, fileSystem }) {
  const handleNewFile = async () => {
    const name = prompt('New file name:');
    if (name) {
      const parentPath = node.type === 'directory' ? node.path : getParentPath(node.path);
      await fileSystem.createFileOrDir(parentPath, name, false);
    }
    onClose();
  };

  const handleNewFolder = async () => {
    const name = prompt('New folder name:');
    if (name) {
      const parentPath = node.type === 'directory' ? node.path : getParentPath(node.path);
      await fileSystem.createFileOrDir(parentPath, name, true);
    }
    onClose();
  };

  const handleRename = async () => {
    const newName = prompt('New name:', node.name);
    if (newName && newName !== node.name) {
      const parentPath = getParentPath(node.path);
      const newPath = parentPath ? `${parentPath}/${newName}` : newName;
      await fileSystem.renameItem(node.path, newPath);
    }
    onClose();
  };

  const handleDelete = async () => {
    if (confirm(`Delete "${node.name}"?`)) {
      await fileSystem.deleteItem(node.path);
    }
    onClose();
  };

  // Adjust position to stay within viewport
  const menuStyle = {
    left: Math.min(x, window.innerWidth - 200),
    top: Math.min(y, window.innerHeight - 200),
  };

  return (
    <>
      <div className="context-menu-overlay" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div className="context-menu" style={menuStyle}>
        <button className="context-menu-item" onClick={handleNewFile}>
          <FilePlus size={14} />
          New File
        </button>
        <button className="context-menu-item" onClick={handleNewFolder}>
          <FolderPlus size={14} />
          New Folder
        </button>
        <div className="context-menu-separator" />
        <button className="context-menu-item" onClick={handleRename}>
          <Pencil size={14} />
          Rename
        </button>
        <div className="context-menu-separator" />
        <button className="context-menu-item danger" onClick={handleDelete}>
          <Trash2 size={14} />
          Delete
        </button>
      </div>
    </>
  );
}

function getParentPath(path) {
  const parts = path.split('/');
  parts.pop();
  return parts.join('/');
}
