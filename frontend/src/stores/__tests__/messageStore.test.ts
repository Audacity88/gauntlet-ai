import { useMessageStore } from '../messageStore';
import { MessageWithUser } from '../../types/models';

describe('Message Store', () => {
  const mockMessage: MessageWithUser = {
    id: '1',
    content: 'Test message',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    channel_id: 'channel1',
    user_id: 'user1',
    user: {
      id: 'user1',
      username: 'testuser',
      full_name: 'Test User',
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  };

  beforeEach(() => {
    useMessageStore.setState({
      messages: new Map(),
      optimisticMessages: new Map(),
      loading: false,
      error: null
    });
  });

  describe('Message operations', () => {
    it('adds a message correctly', () => {
      useMessageStore.getState().addMessage(mockMessage);
      const messages = useMessageStore.getState().messages;
      
      expect(messages.size).toBe(1);
      expect(messages.get(mockMessage.id)).toEqual(mockMessage);
    });

    it('updates a message correctly', () => {
      useMessageStore.getState().addMessage(mockMessage);
      
      const update = { content: 'Updated content' };
      useMessageStore.getState().updateMessage(mockMessage.id, update);
      
      const updatedMessage = useMessageStore.getState().messages.get(mockMessage.id);
      expect(updatedMessage?.content).toBe('Updated content');
    });

    it('removes a message correctly', () => {
      useMessageStore.getState().addMessage(mockMessage);
      useMessageStore.getState().removeMessage(mockMessage.id);
      
      const messages = useMessageStore.getState().messages;
      expect(messages.size).toBe(0);
    });
  });

  describe('Optimistic updates', () => {
    it('handles optimistic messages correctly', () => {
      useMessageStore.getState().addOptimisticMessage(mockMessage);
      
      const optimisticMessages = useMessageStore.getState().optimisticMessages;
      expect(optimisticMessages.size).toBe(1);
      expect(optimisticMessages.get(mockMessage.id)).toEqual(mockMessage);
    });

    it('removes optimistic message when adding real message', () => {
      useMessageStore.getState().addOptimisticMessage(mockMessage);
      useMessageStore.getState().addMessage(mockMessage);
      
      const { messages, optimisticMessages } = useMessageStore.getState();
      expect(messages.size).toBe(1);
      expect(optimisticMessages.size).toBe(0);
    });
  });

  describe('Batch operations', () => {
    it('sets multiple messages correctly', () => {
      const mockMessages = [
        mockMessage,
        { ...mockMessage, id: '2', content: 'Second message' }
      ];
      
      useMessageStore.getState().setMessages(mockMessages);
      
      const messages = useMessageStore.getState().messages;
      expect(messages.size).toBe(2);
      expect(messages.get('1')).toEqual(mockMessages[0]);
      expect(messages.get('2')).toEqual(mockMessages[1]);
    });

    it('clears all messages correctly', () => {
      useMessageStore.getState().addMessage(mockMessage);
      useMessageStore.getState().addOptimisticMessage({
        ...mockMessage,
        id: '2'
      });
      
      useMessageStore.getState().clearMessages();
      
      const { messages, optimisticMessages } = useMessageStore.getState();
      expect(messages.size).toBe(0);
      expect(optimisticMessages.size).toBe(0);
    });
  });

  describe('Loading and error states', () => {
    it('handles loading state correctly', () => {
      useMessageStore.getState().setLoading(true);
      expect(useMessageStore.getState().loading).toBe(true);
      
      useMessageStore.getState().setLoading(false);
      expect(useMessageStore.getState().loading).toBe(false);
    });

    it('handles error state correctly', () => {
      const error = new Error('Test error');
      useMessageStore.getState().setError(error);
      expect(useMessageStore.getState().error).toBe(error);
      
      useMessageStore.getState().setError(null);
      expect(useMessageStore.getState().error).toBe(null);
    });
  });
}); 