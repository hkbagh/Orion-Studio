import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import useEditorStore from './editorStore';

const useWorkspaceStore = create(persist((set) => ({
  // Current workspace
  workspaceId: 'local',
  workspaceName: 'Local Workspace',
  workspacePath: '',
  connectionStatus: 'connected', // 'connected' | 'connecting' | 'disconnected'

  // Sidebar
  sidebarVisible: true,
  sidebarWidth: 260,
  activeSidebarPanel: 'files', // 'files' | 'search' | 'ai' | 'settings'

  // Terminal panel
  terminalVisible: true,
  terminalHeight: 220,

  // AI panel
  aiPanelVisible: false,
  aiPanelWidth: 380,

  // Actions
  toggleSidebar: () => set(s => ({ sidebarVisible: !s.sidebarVisible })),
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  setActiveSidebarPanel: (panel) => set({ activeSidebarPanel: panel, sidebarVisible: true }),

  toggleTerminal: () => set(s => ({ terminalVisible: !s.terminalVisible })),
  setTerminalHeight: (height) => set({ terminalHeight: height }),

  // Run command bridge: set a command here, terminal panel picks it up
  pendingCommand: null,
  setPendingCommand: (cmd) => set({ pendingCommand: cmd }),

  toggleAIPanel: () => set(s => ({ aiPanelVisible: !s.aiPanelVisible })),
  setAIPanelWidth: (width) => set({ aiPanelWidth: width }),

  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setWorkspace: (workspace) => {
    // If workspace changed, clear open files in editor
    if (useWorkspaceStore.getState().workspaceId !== workspace.id) {
      useEditorStore.getState().closeAllFiles();
    }
    set({
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      workspacePath: workspace.path,
    });
  },
}), {
  name: 'orion-workspace-storage',
  partialize: (state) => ({
    workspaceId: state.workspaceId,
    workspaceName: state.workspaceName,
    workspacePath: state.workspacePath,
    sidebarVisible: state.sidebarVisible,
    sidebarWidth: state.sidebarWidth,
    terminalVisible: state.terminalVisible,
    terminalHeight: state.terminalHeight,
  }),
}));

export default useWorkspaceStore;
