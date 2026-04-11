import { create } from 'zustand';

const useAIStore = create((set, get) => ({
  // Conversations
  conversations: [],
  activeConversationId: null,
  messages: [],
  isStreaming: false,
  streamContent: '',

  // Provider config
  activeProvider: null,
  activeModel: null,
  configuredProviders: [],

  // Actions
  setConversations: (conversations) => set({ conversations }),
  setActiveConversation: (id) => set({ activeConversationId: id }),
  
  addMessage: (message) => set(s => ({
    messages: [...s.messages, message],
  })),

  setMessages: (messages) => set({ messages }),

  setStreaming: (isStreaming) => set({ isStreaming }),

  appendStreamContent: (content) => set(s => ({
    streamContent: s.streamContent + content,
  })),

  resetStreamContent: () => set({ streamContent: '' }),

  setConfig: (config) => set({
    activeProvider: config.activeProvider,
    activeModel: config.activeModel,
    configuredProviders: config.configuredProviders || [],
  }),

  // Methods
  clearMessages: () => set({ messages: [], activeConversationId: null }),
}));

export default useAIStore;
