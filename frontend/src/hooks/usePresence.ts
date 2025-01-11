import { useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { getPresenceManager, UserStatus } from '../utils/PresenceManager';
import { useUserStore } from '../stores/userStore';

export function usePresence() {
  const { user } = useAuth();
  const { users } = useUserStore();

  useEffect(() => {
    if (!user) return;

    const presenceManager = getPresenceManager(user.id);
    
    // Initialize presence
    presenceManager.initialize().catch(error => {
      console.error('Failed to initialize presence:', error);
    });

    // Cleanup on unmount
    return () => {
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
    } catch (error) {
      console.error('Failed to update presence:', error);
    }
  }, [user]);

  const isOnline = useCallback((userId: string) => {
    const userState = users.get(userId);
    return userState?.status === 'ONLINE';
  }, [users]);

  const getUserStatus = useCallback((userId: string): UserStatus => {
    return users.get(userId)?.status || 'OFFLINE';
  }, [users]);

  const getLastSeen = useCallback((userId: string): string | null => {
    return users.get(userId)?.last_seen || null;
  }, [users]);

  return {
    updateStatus,
    isOnline,
    getUserStatus,
    getLastSeen
  };
} 