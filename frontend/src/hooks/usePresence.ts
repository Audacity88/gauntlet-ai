import { useEffect, useCallback, useState } from 'react';
import { useAuth } from './useAuth';
import { getPresenceManager, UserStatus, PresenceError } from '../utils/PresenceManager';
import { useUserStore } from '../stores/userStore';

export function usePresence() {
  const { user } = useAuth();
  const { users } = useUserStore();
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    let mounted = true;
    const presenceManager = getPresenceManager(user.id);
    
    // Initialize presence
    presenceManager.initialize()
      .then(() => {
        if (mounted) {
          setInitialized(true);
          setError(null);
        }
      })
      .catch((error: unknown) => {
        console.error('Failed to initialize presence:', error);
        if (mounted) {
          setError(error instanceof PresenceError 
            ? error.message 
            : 'Failed to initialize presence');
        }
      });

    // Cleanup on unmount
    return () => {
      mounted = false;
      presenceManager.cleanup().catch(error => {
        console.error('Failed to cleanup presence:', error);
      });
    };
  }, [user]);

  const updateStatus = useCallback(async (status: UserStatus) => {
    if (!user) return;
    
    const presenceManager = getPresenceManager(user.id);
    try {
      await presenceManager.updatePresence(status);
      setError(null);
    } catch (error: unknown) {
      console.error('Failed to update presence:', error);
      setError(error instanceof PresenceError 
        ? error.message 
        : 'Failed to update presence status');
      throw error; // Re-throw to let the UI handle it
    }
  }, [user]);

  const isOnline = useCallback((userId: string) => {
    const userState = users.get(userId);
    return userState?.is_online ?? false;
  }, [users]);

  const getUserStatus = useCallback((userId: string): UserStatus => {
    return users.get(userId)?.status || 'OFFLINE';
  }, [users]);

  const getLastSeen = useCallback((userId: string): string | null => {
    return users.get(userId)?.last_seen || null;
  }, [users]);

  return {
    initialized,
    error,
    updateStatus,
    isOnline,
    getUserStatus,
    getLastSeen
  };
} 