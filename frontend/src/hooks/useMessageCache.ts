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
  
  // Loading state
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  
  // Error state
  error: Error | null;
  setError: (error: Error | null) => void;
}

const validateMessage = (message: MessageWithUser): boolean => {
  // Allow messages without content (e.g. for attachments)
  return !!(
    message &&
    message.id &&
    message.channel_id &&
    message.user_id &&
    message.user &&
    message.user.id &&
    // Ensure required timestamps exist
    message.created_at &&
    message.updated_at
  );
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

  return {
    getMessage,
    setMessage,
    invalidateMessage,
    invalidateChannelMessages,
    invalidateUserMessages,
    isLoading,
    setLoading,
    error,
    setError
  };
}; 