import { useState, useCallback } from 'react';
import { MessageWithUser } from '../types/models';
import { CacheIntegration } from '../utils/cache/integration';

// Singleton instance of CacheIntegration
const cacheIntegration = new CacheIntegration();

interface UseMessageCacheResult {
  // Cache operations
  getMessage: (id: string) => MessageWithUser | null;
  setMessage: (id: string, message: MessageWithUser) => void;
  invalidateMessage: (id: string) => void;
  invalidateChannelMessages: (channelId: string) => void;
  invalidateUserMessages: (userId: string) => void;
  handleRealtimeUpdate: (message: MessageWithUser) => void;
  
  // Loading state
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  
  // Error state
  error: Error | null;
  setError: (error: Error | null) => void;
}

const validateMessage = (message: MessageWithUser): boolean => {
  // Allow messages without content (e.g. for attachments)
  const hasRequiredFields = !!(
    message &&
    message.id &&
    message.channel_id &&
    message.user_id
  );

  if (!hasRequiredFields) {
    console.warn('Message missing required fields:', message);
    return false;
  }

  // Check timestamps based on message type
  const hasValidTimestamps = !!(
    // For channel messages, require inserted_at
    ('inserted_at' in message && message.inserted_at) ||
    // For DMs, require created_at
    ('created_at' in message && message.created_at)
  );

  if (!hasValidTimestamps) {
    console.warn('Message missing required timestamp:', {
      id: message.id,
      inserted_at: message.inserted_at,
      created_at: message.created_at
    });
    return false;
  }

  return true;
};

export const useMessageCache = (): UseMessageCacheResult => {
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Wrap cache operations with error handling
  const getMessage = useCallback((id: string): MessageWithUser | null => {
    try {
      setError(null);
      return cacheIntegration.getMessage(id);
    } catch (err) {
      console.error('Failed to get message from cache:', err);
      setError(err instanceof Error ? err : new Error('Failed to get message from cache'));
      return null;
    }
  }, []);

  const setMessage = useCallback((id: string, message: MessageWithUser): void => {
    try {
      setError(null);
      if (!validateMessage(message)) {
        console.error('Invalid message format:', message);
        throw new Error('Failed to set message in cache: Invalid message format');
      }
      cacheIntegration.setMessage(id, message);
    } catch (err) {
      console.error('Failed to set message in cache:', err);
      setError(err instanceof Error ? err : new Error('Failed to set message in cache'));
    }
  }, []);

  const invalidateMessage = useCallback((id: string): void => {
    try {
      setError(null);
      cacheIntegration.invalidateMessage(id);
    } catch (err) {
      console.error('Failed to invalidate message in cache:', err);
      setError(err instanceof Error ? err : new Error('Failed to invalidate message in cache'));
    }
  }, []);

  const invalidateChannelMessages = useCallback((channelId: string): void => {
    try {
      setError(null);
      cacheIntegration.invalidateChannelMessages(channelId);
    } catch (err) {
      console.error('Failed to invalidate channel messages in cache:', err);
      setError(err instanceof Error ? err : new Error('Failed to invalidate channel messages in cache'));
    }
  }, []);

  const invalidateUserMessages = useCallback((userId: string): void => {
    try {
      setError(null);
      cacheIntegration.invalidateUserMessages(userId);
    } catch (err) {
      console.error('Failed to invalidate user messages in cache:', err);
      setError(err instanceof Error ? err : new Error('Failed to invalidate user messages in cache'));
    }
  }, []);

  const handleRealtimeUpdate = useCallback((message: MessageWithUser): void => {
    try {
      setError(null);
      // First invalidate any existing cache for this message
      invalidateMessage(message.id);
      // Then invalidate channel cache to force refresh of message list
      if (message.channel_id) {
        invalidateChannelMessages(message.channel_id);
      }
      // Finally set the new message in cache
      setMessage(message.id, message);
    } catch (err) {
      console.error('Failed to handle realtime message update:', err);
      setError(err instanceof Error ? err : new Error('Failed to handle realtime message update'));
    }
  }, [invalidateMessage, invalidateChannelMessages, setMessage]);

  return {
    getMessage,
    setMessage,
    invalidateMessage,
    invalidateChannelMessages,
    invalidateUserMessages,
    handleRealtimeUpdate,
    isLoading,
    setLoading,
    error,
    setError
  };
}; 