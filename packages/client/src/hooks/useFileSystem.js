import { useState, useCallback, useRef } from 'react';
import api from '../services/api';
import { getLanguageFromFilename } from '../utils/languageMap';
import useEditorStore from '../store/editorStore';

export default function useFileSystem(workspaceId = 'local') {
  const [fileTree, setFileTree] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedDirs, setExpandedDirs] = useState(new Set());
  const [selectedPath, setSelectedPath] = useState(null);

  const openFile = useEditorStore(s => s.openFile);

  const fetchFileTree = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const tree = await api.getFileTree(workspaceId);
      setFileTree(tree);
    } catch (err) {
      setError(err.message);
      console.error('Failed to fetch file tree:', err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  const toggleDir = useCallback((path) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const selectFile = useCallback(async (node) => {
    setSelectedPath(node.path);
    
    if (node.type === 'directory') {
      toggleDir(node.path);
      return;
    }

    try {
      const result = await api.readFile(workspaceId, node.path);
      const language = getLanguageFromFilename(node.name);
      openFile({
        path: node.path,
        name: node.name,
        content: result.content,
        language,
      });
    } catch (err) {
      console.error('Failed to read file:', err);
    }
  }, [workspaceId, openFile, toggleDir]);

  const createFileOrDir = useCallback(async (parentPath, name, isDirectory = false) => {
    try {
      const fullPath = parentPath ? `${parentPath}/${name}` : name;
      await api.createFile(workspaceId, fullPath, '', isDirectory);
      await fetchFileTree();

      if (isDirectory) {
        setExpandedDirs(prev => new Set([...prev, fullPath]));
      }

      return fullPath;
    } catch (err) {
      console.error('Failed to create:', err);
      throw err;
    }
  }, [workspaceId, fetchFileTree]);

  const deleteItem = useCallback(async (path) => {
    try {
      await api.deleteFile(workspaceId, path);
      await fetchFileTree();
    } catch (err) {
      console.error('Failed to delete:', err);
      throw err;
    }
  }, [workspaceId, fetchFileTree]);

  const renameItem = useCallback(async (path, newPath) => {
    try {
      await api.renameFile(workspaceId, path, newPath);
      await fetchFileTree();
    } catch (err) {
      console.error('Failed to rename:', err);
      throw err;
    }
  }, [workspaceId, fetchFileTree]);

  const saveFile = useCallback(async (path, content) => {
    try {
      await api.updateFile(workspaceId, path, content);
      useEditorStore.getState().markFileSaved(path, content);
    } catch (err) {
      console.error('Failed to save file:', err);
      throw err;
    }
  }, [workspaceId]);

  return {
    fileTree,
    loading,
    error,
    expandedDirs,
    selectedPath,
    fetchFileTree,
    toggleDir,
    selectFile,
    createFileOrDir,
    deleteItem,
    renameItem,
    saveFile,
  };
}
