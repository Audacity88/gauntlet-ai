import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { DirectMessageWithDetails } from '../utils/DirectMessageProcessor';

interface DirectMessageState {
  conversations: Map<string, DirectMessageWithDetails>;
  activeConversation: string | null;
  loading: boolean;
  error: Error | null;
  optimisticMessages: Map<string, DirectMessageWithDetails>;

  // Message operations
  addMessage: (message: DirectMessageWithDetails) => void;
  updateMessage: (id: string, update: Partial<DirectMessageWithDetails>) => void;
  removeMessage: (id: string) => void;
  setActiveConversation: (userId: string | null) => void;

  // Optimistic operations
  addOptimisticMessage: (message: DirectMessageWithDetails) => void;
  removeOptimisticMessage: (id: string) => void;
  clearOptimisticMessages: () => void;

  // Batch operations
  setConversationMessages: (conversations: Map<string, DirectMessageWithDetails>) => void;
  clearConversation: (userId: string) => void;
  clearAllConversations: () => void;

  // Loading state
  setLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;
}

export const useDirectMessageStore = create<DirectMessageState>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        conversations: new Map(),
        activeConversation: null,
        loading: false,
        error: null,
        optimisticMessages: new Map(),

        // Message operations
        addMessage: (message) =>
          set((state) => {
            const newConversations = new Map(state.conversations)
            newConversations.set(message.id, message)
            return { conversations: newConversations }
          }),

        updateMessage: (id, update) =>
          set((state) => {
            const message = state.conversations.get(id)
            if (!message) return state

            const newConversations = new Map(state.conversations)
            newConversations.set(id, { ...message, ...update })
            return { conversations: newConversations }
          }),

        removeMessage: (id) =>
          set((state) => {
            const newConversations = new Map(state.conversations)
            newConversations.delete(id)
            return { conversations: newConversations }
          }),

        setActiveConversation: (userId) =>
          set(() => ({
            activeConversation: userId
          })),

        // Optimistic operations
        addOptimisticMessage: (message) =>
          set((state) => {
            const newOptimistic = new Map(state.optimisticMessages)
            newOptimistic.set(message.id, message)
            return { optimisticMessages: newOptimistic }
          }),

        removeOptimisticMessage: (id) =>
          set((state) => {
            const newOptimistic = new Map(state.optimisticMessages)
            newOptimistic.delete(id)
            return { optimisticMessages: newOptimistic }
          }),

        clearOptimisticMessages: () =>
          set(() => ({
            optimisticMessages: new Map()
          })),

        // Batch operations
        setConversationMessages: (conversations) =>
          set(() => ({
            conversations,
            loading: false,
            error: null
          })),

        clearConversation: (userId) =>
          set((state) => {
            const newConversations = new Map(state.conversations)
            newConversations.delete(userId)
            return { conversations: newConversations }
          }),

        clearAllConversations: () =>
          set(() => ({
            conversations: new Map(),
            optimisticMessages: new Map(),
            activeConversation: null,
            error: null
          })),

        // Loading state
        setLoading: (loading) => set(() => ({ loading })),
        setError: (error) => set(() => ({ error }))
      }),
      {
        name: 'direct-message-store',
        storage: {
          getItem: (name) => {
            const str = localStorage.getItem(name);
            if (!str) return null;
            const { state } = JSON.parse(str);
            return {
              state: {
                ...state,
                conversations: new Map(state.conversations?.__type === 'Map' ? state.conversations.data : []),
                optimisticMessages: new Map(state.optimisticMessages?.__type === 'Map' ? state.optimisticMessages.data : [])
              }
            };
          },
          setItem: (name, value) => {
            const { state } = value;
            const serializedState = {
              ...state,
              conversations: {
                __type: 'Map',
                data: Array.from(state.conversations.entries())
              },
              optimisticMessages: {
                __type: 'Map',
                data: Array.from(state.optimisticMessages.entries())
              }
            };
            localStorage.setItem(name, JSON.stringify({ state: serializedState }));
          },
          removeItem: (name) => localStorage.removeItem(name)
        }
      }
    ),
    { name: 'DirectMessageStore' }
  )
); 