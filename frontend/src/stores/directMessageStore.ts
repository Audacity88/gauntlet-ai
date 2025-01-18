import { create } from 'zustand'
import { DirectMessageWithDetails } from '../utils/DirectMessageProcessor'

interface Conversation {
  messages: DirectMessageWithDetails[];
  otherUserId: string;
  channelId: string;
  members?: Array<{
    user_id: string;
    profile: any;
  }>;
}

interface DirectMessageStore {
  conversations: Map<string, Conversation>;
  loading: boolean;
  error: Error | null;
  setLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;
  setConversationMessages: (messages: Map<string, Conversation>) => void;
  addMessage: (channelId: string, message: DirectMessageWithDetails) => void;
  updateMessage: (channelId: string, messageId: string, message: DirectMessageWithDetails) => void;
  removeMessage: (channelId: string, messageId: string) => void;
}

export const useDirectMessageStore = create<DirectMessageStore>((set) => ({
  conversations: new Map(),
  loading: false,
  error: null,
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setConversationMessages: (messages) => set({ conversations: messages }),
  
  addMessage: (channelId, message) => 
    set((state) => {
      const newConversations = new Map(state.conversations);
      const conversation = newConversations.get(message.receiver.id);
      
      if (conversation) {
        conversation.messages = [...conversation.messages, message];
        newConversations.set(message.receiver.id, conversation);
      }
      
      return { conversations: newConversations };
    }),
    
  updateMessage: (channelId, messageId, message) =>
    set((state) => {
      const newConversations = new Map(state.conversations);
      const conversation = newConversations.get(message.receiver.id);
      
      if (conversation) {
        conversation.messages = conversation.messages.map((msg) =>
          msg.id === messageId ? message : msg
        );
        newConversations.set(message.receiver.id, conversation);
      }
      
      return { conversations: newConversations };
    }),
    
  removeMessage: (channelId, messageId) =>
    set((state) => {
      const newConversations = new Map(state.conversations);
      
      // Find the conversation that contains this message
      for (const [userId, conversation] of newConversations.entries()) {
        if (conversation.channelId === channelId) {
          conversation.messages = conversation.messages.filter(
            (msg) => msg.id !== messageId
          );
          newConversations.set(userId, conversation);
          break;
        }
      }
      
      return { conversations: newConversations };
    }),
})); 