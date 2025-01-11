import { supabase } from '../lib/supabaseClient';
import { User } from '../types/models';
import { useUserStore } from '../stores/userStore';

export type UserStatus = 'ONLINE' | 'OFFLINE' | 'AWAY' | 'BUSY';

export interface PresenceState {
  user_id: string;
  status: UserStatus;
  last_seen: string;
}

export class PresenceManager {
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds

  constructor(private userId: string) {}

  async initialize() {
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
          this.handlePresenceSync(state);
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
        await this.updatePresence('ONLINE');
        this.startHeartbeat();
      }
    });

    return status === 'SUBSCRIBED';
  }

  private async handlePresenceSync(state: Record<string, PresenceState[]>) {
    const onlineUserIds = new Set<string>();
    
    Object.entries(state).forEach(([_, presences]) => {
      presences.forEach((presence) => {
        if (presence.status !== 'OFFLINE') {
          onlineUserIds.add(presence.user_id);
        }
      });
    });

    // Update the user store with online users
    useUserStore.getState().setOnlineUsers(Array.from(onlineUserIds));

    // Update last seen timestamps in the database
    const now = new Date().toISOString();
    await supabase
      .from('profiles')
      .update({ last_seen: now })
      .in('id', Array.from(onlineUserIds));
  }

  private handlePresenceJoin(userId: string, presence: PresenceState) {
    if (presence.status !== 'OFFLINE') {
      useUserStore.getState().setUserOnline(userId);
    }
  }

  private handlePresenceLeave(userId: string) {
    useUserStore.getState().setUserOffline(userId);
  }

  async updatePresence(status: UserStatus) {
    if (!this.channel) return;

    const now = new Date().toISOString();
    
    try {
      // Update presence state
      await this.channel.track({
        user_id: this.userId,
        status,
        last_seen: now
      });

      // Update user profile
      await supabase
        .from('profiles')
        .update({
          status,
          last_seen: now
        })
        .eq('id', this.userId);

    } catch (error) {
      console.error('Error updating presence:', error);
    }
  }

  private startHeartbeat() {
    // Clear any existing heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Start new heartbeat
    this.heartbeatInterval = setInterval(async () => {
      const currentStatus = useUserStore.getState().users.get(this.userId)?.status || 'ONLINE';
      await this.updatePresence(currentStatus);
    }, this.HEARTBEAT_INTERVAL);
  }

  async cleanup() {
    // Clear heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Update status to offline
    await this.updatePresence('OFFLINE');

    // Unsubscribe from channel
    if (this.channel) {
      await this.channel.unsubscribe();
      this.channel = null;
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