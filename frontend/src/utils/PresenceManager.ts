import { supabase } from '../lib/supabaseClient';
import { User } from '../types/models';
import { useUserStore } from '../stores/userStore';

export type UserStatus = 'ONLINE' | 'OFFLINE' | 'AWAY' | 'BUSY';

export interface PresenceState {
  user_id: string;
  status: UserStatus;
  last_seen: string;
}

export class PresenceError extends Error {
  constructor(message: string, public originalError?: unknown) {
    super(message);
    this.name = 'PresenceError';
  }
}

export class PresenceManager {
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private lastStatus: UserStatus = 'OFFLINE';
  private isCleaningUp = false;
  private initPromise: Promise<boolean> | null = null;
  private isInitialized = false;

  constructor(private userId: string) {}

  async initialize() {
    // If already initialized, return true
    if (this.isInitialized) {
      return true;
    }

    // If already initializing, return the existing promise
    if (this.initPromise) {
      return this.initPromise;
    }

    // If cleaning up, wait for cleanup to complete
    if (this.isCleaningUp) {
      await new Promise(resolve => setTimeout(resolve, 100));
      return this.initialize();
    }

    this.initPromise = this._initialize();
    return this.initPromise;
  }

  private async _initialize(): Promise<boolean> {
    try {
      // First, get the current user's status from the database
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', this.userId)
        .single();

      if (profileError) {
        throw new PresenceError('Failed to fetch user profile', profileError);
      }

      // Initialize presence channel
      this.channel = supabase.channel('presence', {
        config: {
          presence: {
            key: this.userId,
          },
        },
      });

      // Set up presence handlers
      this.channel
        .on('presence', { event: 'sync' }, () => {
          const state = this.channel?.presenceState<PresenceState>();
          if (state) {
            this.handlePresenceSync(state).catch(error => {
              console.error('Error in presence sync:', error);
            });
          }
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          this.handlePresenceJoin(key as string, newPresences[0] as PresenceState);
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          this.handlePresenceLeave(key as string);
        });

      // Subscribe to the channel
      const status = await this.channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          this.isInitialized = true;
          // Use the stored status from the database, or default to ONLINE
          const initialStatus = profile?.status || 'ONLINE';
          this.lastStatus = initialStatus;
          if (!this.isCleaningUp) {
            await this.updatePresence(initialStatus);
            this.startHeartbeat();
          }
        }
      });

      return status === 'SUBSCRIBED';
    } catch (error) {
      this.initPromise = null; // Reset so we can try again
      this.isInitialized = false;
      if (error instanceof PresenceError) {
        throw error;
      }
      throw new PresenceError('Failed to initialize presence', error);
    }
  }

  private async handlePresenceSync(state: Record<string, PresenceState[]>) {
    if (this.isCleaningUp) return;

    try {
      const onlineUserIds = new Set<string>();
      const userStatuses = new Map<string, UserStatus>();
      
      Object.entries(state).forEach(([_, presences]) => {
        presences.forEach((presence) => {
          if (presence.status !== 'OFFLINE') {
            onlineUserIds.add(presence.user_id);
            userStatuses.set(presence.user_id, presence.status);
          }
        });
      });

      // Update the user store with online users
      useUserStore.getState().setOnlineUsers(Array.from(onlineUserIds));

      // Update user statuses in the store
      userStatuses.forEach((status, userId) => {
        useUserStore.getState().updateUser(userId, { status });
      });

      // Only update last seen if we have online users
      if (onlineUserIds.size > 0) {
        // Update last seen timestamps in the database
        const now = new Date().toISOString();
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ last_seen: now })
          .in('id', Array.from(onlineUserIds));

        if (updateError) {
          throw new PresenceError('Failed to update last seen timestamps', updateError);
        }
      }
    } catch (error) {
      console.error('Error in handlePresenceSync:', error);
    }
  }

  private handlePresenceJoin(userId: string, presence: PresenceState) {
    if (this.isCleaningUp) return;

    try {
      if (presence.status !== 'OFFLINE') {
        useUserStore.getState().setUserOnline(userId);
        useUserStore.getState().updateUser(userId, { status: presence.status });
      }
    } catch (error) {
      console.error('Error in handlePresenceJoin:', error);
    }
  }

  private handlePresenceLeave(userId: string) {
    if (this.isCleaningUp) return;

    try {
      useUserStore.getState().setUserOffline(userId);
      useUserStore.getState().updateUser(userId, { status: 'OFFLINE' });
    } catch (error) {
      console.error('Error in handlePresenceLeave:', error);
    }
  }

  async updatePresence(status: UserStatus) {
    if (this.isCleaningUp) {
      return; // Silently return instead of throwing during cleanup
    }

    if (!this.channel || !this.isInitialized) {
      throw new PresenceError('Presence channel not initialized');
    }

    // Don't update if status hasn't changed
    if (status === this.lastStatus) {
      return;
    }

    const now = new Date().toISOString();
    
    try {
      // First update the database
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          status: status,
          last_seen: now
        })
        .eq('id', this.userId);

      if (updateError) {
        throw new PresenceError('Failed to update user profile', updateError);
      }

      // Then update presence state
      await this.channel.track({
        user_id: this.userId,
        status,
        last_seen: now
      });

      // Update local store
      useUserStore.getState().updateUser(this.userId, { 
        status,
        last_seen: now
      });

      this.lastStatus = status;
    } catch (error) {
      if (error instanceof PresenceError) {
        throw error;
      }
      throw new PresenceError('Failed to update presence', error);
    }
  }

  private startHeartbeat() {
    // Clear any existing heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Start new heartbeat
    this.heartbeatInterval = setInterval(async () => {
      if (this.isCleaningUp || !this.isInitialized) return;

      try {
        const currentStatus = useUserStore.getState().users.get(this.userId)?.status || 'ONLINE';
        await this.updatePresence(currentStatus);
      } catch (error) {
        console.error('Error in heartbeat:', error);
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  async cleanup() {
    if (this.isCleaningUp) return;
    
    this.isCleaningUp = true;

    try {
      // Clear heartbeat first
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }

      // Update database directly without using channel
      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          status: 'OFFLINE',
          last_seen: now
        })
        .eq('id', this.userId);

      if (updateError) {
        console.error('Failed to update profile during cleanup:', updateError);
      }

      // Update local store
      useUserStore.getState().updateUser(this.userId, {
        status: 'OFFLINE',
        last_seen: now
      });

      // Finally, unsubscribe from channel
      if (this.channel) {
        await this.channel.unsubscribe();
        this.channel = null;
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    } finally {
      this.isInitialized = false;
      this.isCleaningUp = false;
      this.lastStatus = 'OFFLINE';
      this.initPromise = null;
    }
  }
}

// Create a singleton instance
let presenceManager: PresenceManager | null = null;

export function getPresenceManager(userId: string) {
  if (!presenceManager || presenceManager.userId !== userId) {
    presenceManager = new PresenceManager(userId);
  }
  return presenceManager;
} 