import { useState, useCallback } from 'react';
import { Channel } from '../types/models';
import { CacheIntegration } from '../utils/cache/integration';

// Singleton instance of CacheIntegration
const cacheIntegration = new CacheIntegration();

interface UseChannelCacheResult {
  // Cache operations
  getChannel: (id: string) => Channel | null;
  setChannel: (id: string, channel: Channel) => void;
  invalidateChannel: (id: string) => void;
  invalidateChannelType: (type: 'public' | 'private') => void;
  invalidateCreatorChannels: (userId: string) => void;
  
  // Loading state
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  
  // Error state
  error: Error | null;
  setError: (error: Error | null) => void;
}

const validateChannel = (channel: Channel): boolean => {
  return !!(
    channel &&
    channel.id &&
    channel.slug &&
    channel.type &&
    channel.created_by &&
    (channel.type === 'public' || channel.type === 'private')
  );
};

export const useChannelCache = (): UseChannelCacheResult => {
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Wrap cache operations with error handling
  const getChannel = useCallback((id: string): Channel | null => {
    try {
      setError(null);
      return cacheIntegration.getChannel(id);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to get channel from cache'));
      return null;
    }
  }, []);

  const setChannel = useCallback((id: string, channel: Channel): void => {
    try {
      setError(null);
      if (!validateChannel(channel)) {
        throw new Error('Failed to set channel in cache: Invalid channel format');
      }
      cacheIntegration.setChannel(id, channel);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to set channel in cache'));
    }
  }, []);

  const invalidateChannel = useCallback((id: string): void => {
    try {
      setError(null);
      cacheIntegration.invalidateChannel(id);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to invalidate channel in cache'));
    }
  }, []);

  const invalidateChannelType = useCallback((type: 'public' | 'private'): void => {
    try {
      setError(null);
      cacheIntegration.invalidateChannelType(type);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to invalidate channel type in cache'));
    }
  }, []);

  const invalidateCreatorChannels = useCallback((userId: string): void => {
    try {
      setError(null);
      cacheIntegration.invalidateCreatorChannels(userId);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to invalidate creator channels in cache'));
    }
  }, []);

  return {
    getChannel,
    setChannel,
    invalidateChannel,
    invalidateChannelType,
    invalidateCreatorChannels,
    isLoading,
    setLoading,
    error,
    setError
  };
}; 