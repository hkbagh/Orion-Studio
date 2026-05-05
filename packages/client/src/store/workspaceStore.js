import { create } from 'zustand';

const useWorkspaceStore = create((set) => ({
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
  setWorkspace: (workspace) => set({
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    workspacePath: workspace.path,
  }),
}));

export default useWorkspaceStore;
