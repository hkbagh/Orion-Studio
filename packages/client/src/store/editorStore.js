import { create } from 'zustand';

const useEditorStore = create((set, get) => ({
  // Open files: array of { id, path, name, content, language, isDirty, originalContent }
  openFiles: [],
  activeFileId: null,

  // Pending diffs from AI edits: { [filePath]: { originalContent, newContent } }
  pendingDiffs: {},

  // Open a file in the editor
  openFile: (file) => {
    const { openFiles } = get();
    const existing = openFiles.find(f => f.path === file.path);
    
    if (existing) {
      // Already open — just activate it
      set({ activeFileId: existing.id });
      return;
    }

    const newFile = {
      id: file.path,
      path: file.path,
      name: file.name,
      content: file.content || '',
      language: file.language || 'plaintext',
      isDirty: false,
      originalContent: file.content || '',
    };

    set({
      openFiles: [...openFiles, newFile],
      activeFileId: newFile.id,
    });
  },

  // Close a file
  closeFile: (fileId) => {
    const { openFiles, activeFileId, pendingDiffs } = get();
    const closedFile = openFiles.find(f => f.id === fileId);
    const idx = openFiles.findIndex(f => f.id === fileId);
    const newFiles = openFiles.filter(f => f.id !== fileId);

    let newActiveId = activeFileId;
    if (activeFileId === fileId) {
      if (newFiles.length === 0) {
        newActiveId = null;
      } else if (idx >= newFiles.length) {
        newActiveId = newFiles[newFiles.length - 1].id;
      } else {
        newActiveId = newFiles[idx].id;
      }
    }

    // Also clear any pending diff for this file
    const newDiffs = { ...pendingDiffs };
    if (closedFile) delete newDiffs[closedFile.path];

    set({ openFiles: newFiles, activeFileId: newActiveId, pendingDiffs: newDiffs });
  },

  // Activate a tab
  setActiveFile: (fileId) => {
    set({ activeFileId: fileId });
  },

  // Update file content (marks as dirty)
  updateFileContent: (fileId, content) => {
    set(state => ({
      openFiles: state.openFiles.map(f =>
        f.id === fileId
          ? { ...f, content, isDirty: content !== f.originalContent }
          : f
      ),
    }));
  },

  // Mark file as saved
  markFileSaved: (fileId, content) => {
    set(state => ({
      openFiles: state.openFiles.map(f =>
        f.id === fileId
          ? { ...f, isDirty: false, originalContent: content ?? f.content }
          : f
      ),
    }));
  },

  // Update file content from external source (e.g., AI edit)
  setFileContent: (path, content) => {
    set(state => ({
      openFiles: state.openFiles.map(f =>
        f.path === path
          ? { ...f, content, originalContent: content, isDirty: false }
          : f
      ),
    }));
  },

  // ── Diff Management ──

  // Set a pending diff from an AI edit
  setPendingDiff: (filePath, originalContent, newContent) => {
    set(state => ({
      pendingDiffs: {
        ...state.pendingDiffs,
        [filePath]: { originalContent, newContent },
      },
    }));
  },

  // Accept an AI diff — apply the new content
  acceptDiff: (filePath) => {
    const { pendingDiffs } = get();
    const diff = pendingDiffs[filePath];
    if (!diff) return;

    const newDiffs = { ...pendingDiffs };
    delete newDiffs[filePath];

    set(state => ({
      pendingDiffs: newDiffs,
      openFiles: state.openFiles.map(f =>
        f.path === filePath
          ? { ...f, content: diff.newContent, originalContent: diff.newContent, isDirty: false }
          : f
      ),
    }));
  },

  // Reject an AI diff — revert to original
  rejectDiff: (filePath) => {
    const { pendingDiffs } = get();
    const diff = pendingDiffs[filePath];
    if (!diff) return;

    const newDiffs = { ...pendingDiffs };
    delete newDiffs[filePath];

    set(state => ({
      pendingDiffs: newDiffs,
      openFiles: state.openFiles.map(f =>
        f.path === filePath
          ? { ...f, content: diff.originalContent, originalContent: diff.originalContent, isDirty: false }
          : f
      ),
    }));
  },

  // Get the pending diff for a file path
  getPendingDiff: (filePath) => {
    return get().pendingDiffs[filePath] || null;
  },

  // Get active file
  getActiveFile: () => {
    const { openFiles, activeFileId } = get();
    return openFiles.find(f => f.id === activeFileId) || null;
  },

  // Close all files
  closeAllFiles: () => {
    set({ openFiles: [], activeFileId: null, pendingDiffs: {} });
  },
}));

export default useEditorStore;
