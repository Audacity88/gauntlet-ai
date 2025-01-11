import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { BaseMessage, MessageWithUser } from '../types/models';

interface MessageState {
  messages: Map<string, MessageWithUser>;
  optimisticMessages: Map<string, MessageWithUser>;
  loading: boolean;
  error: Error | null;

  // Message operations
  addMessage: (message: MessageWithUser) => void;
  updateMessage: (id: string, update: Partial<MessageWithUser>) => void;
  removeMessage: (id: string) => void;
  addOptimisticMessage: (message: MessageWithUser) => void;
  removeOptimisticMessage: (id: string) => void;

  // Batch operations
  setMessages: (messages: MessageWithUser[]) => void;
  clearMessages: () => void;

  // Loading state
  setLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;
}

export const useMessageStore = create<MessageState>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        messages: new Map(),
        optimisticMessages: new Map(),
        loading: false,
        error: null,

        // Message operations
        addMessage: (message) =>
          set((state) => {
            const newMessages = new Map(state.messages);
            newMessages.set(message.id, message);
            // Remove from optimistic messages if exists
            const newOptimisticMessages = new Map(state.optimisticMessages);
            newOptimisticMessages.delete(message.id);
            return { 
              messages: newMessages,
              optimisticMessages: newOptimisticMessages
            };
          }),

        updateMessage: (id, update) =>
          set((state) => {
            const message = state.messages.get(id);
            if (!message) return state;

            const newMessages = new Map(state.messages);
            newMessages.set(id, { ...message, ...update });
            return { messages: newMessages };
          }),

        removeMessage: (id) =>
          set((state) => {
            const newMessages = new Map(state.messages);
            newMessages.delete(id);
            return { messages: newMessages };
          }),

        addOptimisticMessage: (message) =>
          set((state) => {
            const newOptimisticMessages = new Map(state.optimisticMessages);
            newOptimisticMessages.set(message.id, message);
            return { optimisticMessages: newOptimisticMessages };
          }),

        removeOptimisticMessage: (id) =>
          set((state) => {
            const newOptimisticMessages = new Map(state.optimisticMessages);
            newOptimisticMessages.delete(id);
            return { optimisticMessages: newOptimisticMessages };
          }),

        // Batch operations
        setMessages: (messages) =>
          set(() => ({
            messages: new Map(messages.map(msg => [msg.id, msg])),
            loading: false,
            error: null
          })),

        clearMessages: () =>
          set(() => ({
            messages: new Map(),
            optimisticMessages: new Map(),
            error: null
          })),

        // Loading state
        setLoading: (loading) => set(() => ({ loading })),
        setError: (error) => set(() => ({ error }))
      }),
      {
        name: 'message-store',
        storage: {
          getItem: (name) => {
            const str = localStorage.getItem(name);
            if (!str) return null;
            const { state } = JSON.parse(str);
            return {
              state: {
                ...state,
                messages: new Map(state.messages?.__type === 'Map' ? state.messages.data : []),
                optimisticMessages: new Map(state.optimisticMessages?.__type === 'Map' ? state.optimisticMessages.data : [])
              }
            };
          },
          setItem: (name, value) => {
            const { state } = value;
            const serializedState = {
              ...state,
              messages: {
                __type: 'Map',
                data: Array.from(state.messages.entries())
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
    { name: 'MessageStore' }
  )
); 