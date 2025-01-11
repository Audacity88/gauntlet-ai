import { useState, useCallback } from 'react';
import { User } from '../types/models';
import { CacheIntegration } from '../utils/cache/integration';
import { supabase } from '../lib/supabaseClient';

// Singleton instance of CacheIntegration
const cacheIntegration = new CacheIntegration();

interface UseUserCacheResult {
  // Cache operations
  getUser: (id: string) => User | null;
  setUser: (id: string, user: User) => void;
  invalidateUser: (id: string) => void;
  
  // Online status operations
  setUserOnline: (id: string) => void;
  setUserOffline: (id: string) => void;
  isUserOnline: (id: string) => boolean;
  updateUserStatus: (userId: string, status: string) => Promise<void>;
  
  // Loading state
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  
  // Error state
  error: Error | null;
  setError: (error: Error | null) => void;
}

const validateUser = (user: User): boolean => {
  return !!(
    user &&
    user.id &&
    typeof user.username === 'string' &&
    typeof user.full_name === 'string' &&
    typeof user.created_at === 'string' &&
    typeof user.updated_at === 'string'
  );
};

export const useUserCache = (): UseUserCacheResult => {
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Wrap cache operations with error handling
  const getUser = useCallback((id: string): User | null => {
    try {
      setError(null);
      return cacheIntegration.getUser(id);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to get user from cache'));
      return null;
    }
  }, []);

  const setUser = useCallback((id: string, user: User): void => {
    try {
      setError(null);
      if (!validateUser(user)) {
        throw new Error('Failed to set user in cache: Invalid user format');
      }
      cacheIntegration.setUser(id, user);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to set user in cache'));
    }
  }, []);

  const invalidateUser = useCallback((id: string): void => {
    try {
      setError(null);
      cacheIntegration.invalidateUser(id);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to invalidate user in cache'));
    }
  }, []);

  const setUserOnline = useCallback((id: string): void => {
    try {
      setError(null);
      const user = cacheIntegration.getUser(id);
      if (!user) {
        throw new Error('User not found in cache');
      }
      cacheIntegration.setUserOnline(id);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to set user online status'));
    }
  }, []);

  const setUserOffline = useCallback((id: string): void => {
    try {
      setError(null);
      const user = cacheIntegration.getUser(id);
      if (!user) {
        throw new Error('User not found in cache');
      }
      cacheIntegration.setUserOffline(id);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to set user offline status'));
    }
  }, []);

  const isUserOnline = useCallback((id: string): boolean => {
    try {
      setError(null);
      return cacheIntegration.isUserOnline(id);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to check user online status'));
      return false;
    }
  }, []);

  const updateUserStatus = useCallback(async (userId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status })
        .eq('id', userId);

      if (error) throw error;

      // Update the cache
      const user = cacheIntegration.getUser(userId);
      if (user) {
        cacheIntegration.setUser(userId, { ...user, status });
      }
    } catch (err) {
      console.error('Failed to update user status:', err);
      throw err;
    }
  }, []);

  return {
    getUser,
    setUser,
    invalidateUser,
    setUserOnline,
    setUserOffline,
    isUserOnline,
    updateUserStatus,
    isLoading,
    setLoading,
    error,
    setError
  };
}; 