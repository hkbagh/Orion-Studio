import { create } from 'zustand';

const useCollaborationStore = create((set, get) => ({
  // Session state
  isCollaborating: false,
  sessionId: null,
  sessionToken: null,
  permission: null, // 'viewer' | 'editor' | 'admin'
  workspaceId: null,
  
  // Participants
  participants: [], // [{ clientId, username, userId, permission, joinedAt }]
  currentUser: null, // { clientId, username, participantId }
  
  // Connection state
  connectionStatus: 'disconnected', // 'connecting' | 'connected' | 'disconnected' | 'error'
  connectionError: null,
  
  // Yjs state
  yjsDoc: null,
  awareness: null,
  provider: null,
  
  // UI state
  showParticipants: false,
  showShareDialog: false,
  
  // Actions
  setSessionInfo: (info) => set({
    sessionId: info.sessionId,
    sessionToken: info.sessionToken,
    permission: info.permission,
    workspaceId: info.workspaceId,
    isCollaborating: true,
  }),
  
  setCurrentUser: (user) => set({ currentUser: user }),
  
  setConnectionStatus: (status, error = null) => set({
    connectionStatus: status,
    connectionError: error,
  }),
  
  addParticipant: (participant) => set((state) => {
    const exists = state.participants.find(p => p.clientId === participant.clientId);
    if (exists) return state;
    
    return {
      participants: [...state.participants, participant],
    };
  }),
  
  removeParticipant: (clientId) => set((state) => ({
    participants: state.participants.filter(p => p.clientId !== clientId),
  })),
  
  updateParticipant: (clientId, updates) => set((state) => ({
    participants: state.participants.map(p =>
      p.clientId === clientId ? { ...p, ...updates } : p
    ),
  })),
  
  setYjsDoc: (doc) => set({ yjsDoc: doc }),
  setAwareness: (awareness) => set({ awareness }),
  setProvider: (provider) => set({ provider }),
  
  toggleParticipants: () => set((state) => ({
    showParticipants: !state.showParticipants,
  })),
  
  toggleShareDialog: () => set((state) => ({
    showShareDialog: !state.showShareDialog,
  })),
  
  // Leave session
  leaveSession: () => {
    const { provider, yjsDoc } = get();
    
    if (provider) {
      provider.destroy();
    }
    if (yjsDoc) {
      yjsDoc.destroy();
    }
    
    set({
      isCollaborating: false,
      sessionId: null,
      sessionToken: null,
      permission: null,
      workspaceId: null,
      participants: [],
      currentUser: null,
      connectionStatus: 'disconnected',
      connectionError: null,
      yjsDoc: null,
      awareness: null,
      provider: null,
    });
  },
  
  // Check if current user can edit
  canEdit: () => {
    const { permission } = get();
    return permission === 'editor' || permission === 'admin';
  },
  
  // Check if current user is admin
  isAdmin: () => {
    const { permission } = get();
    return permission === 'admin';
  },
}));

export default useCollaborationStore;
