import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PresenceManager, UserStatus } from '../PresenceManager';
import { supabase } from '@/lib/supabaseClient';
import { useUserStore } from '@/stores/userStore';

// Mock Supabase client
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockResolvedValue('SUBSCRIBED'),
      track: vi.fn().mockResolvedValue(undefined),
      unsubscribe: vi.fn().mockResolvedValue(undefined),
      presenceState: vi.fn().mockReturnValue({})
    })),
    from: vi.fn(() => ({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      in: vi.fn().mockResolvedValue({ data: null, error: null })
    })),
    removeChannel: vi.fn()
  }
}));

// Mock user store
vi.mock('@/stores/userStore', () => ({
  useUserStore: {
    getState: vi.fn(() => ({
      setUserOnline: vi.fn(),
      setUserOffline: vi.fn(),
      setOnlineUsers: vi.fn(),
      users: new Map([['test-user', { id: 'test-user', status: 'ONLINE' }]])
    }))
  }
}));

describe('PresenceManager', () => {
  const userId = 'test-user';
  let manager: PresenceManager;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new PresenceManager(userId);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('initializes presence channel correctly', async () => {
    await manager.initialize();

    expect(supabase.channel).toHaveBeenCalledWith('presence', {
      config: {
        presence: {
          key: userId,
        },
      },
    });
  });

  it('updates presence status correctly', async () => {
    await manager.initialize();
    await manager.updatePresence('AWAY');

    expect(supabase.from).toHaveBeenCalledWith('profiles');
    expect(supabase.from().update).toHaveBeenCalledWith({
      status: 'AWAY',
      last_seen: expect.any(String)
    });
  });

  it('handles presence sync correctly', async () => {
    await manager.initialize();

    const mockState = {
      'user-1': [{ user_id: 'user-1', status: 'ONLINE' }],
      'user-2': [{ user_id: 'user-2', status: 'AWAY' }]
    };

    // @ts-ignore - Mock implementation
    supabase.channel().presenceState.mockReturnValue(mockState);

    // Trigger presence sync
    const syncHandler = supabase.channel().on.mock.calls.find(
      call => call[0] === 'presence' && call[1].event === 'sync'
    )[2];
    
    syncHandler();

    expect(useUserStore.getState().setOnlineUsers).toHaveBeenCalledWith(
      ['user-1', 'user-2']
    );
  });

  it('cleans up resources correctly', async () => {
    await manager.initialize();
    await manager.cleanup();

    expect(supabase.channel().unsubscribe).toHaveBeenCalled();
  });

  it('maintains heartbeat interval', async () => {
    await manager.initialize();

    // Fast-forward 30 seconds
    vi.advanceTimersByTime(30000);

    expect(supabase.from).toHaveBeenCalledWith('profiles');
    expect(supabase.from().update).toHaveBeenCalled();
  });

  it('handles presence join event correctly', async () => {
    await manager.initialize();

    const joinHandler = supabase.channel().on.mock.calls.find(
      call => call[0] === 'presence' && call[1].event === 'join'
    )[2];

    joinHandler({
      key: 'user-1',
      newPresences: [{ user_id: 'user-1', status: 'ONLINE' }]
    });

    expect(useUserStore.getState().setUserOnline).toHaveBeenCalledWith('user-1');
  });

  it('handles presence leave event correctly', async () => {
    await manager.initialize();

    const leaveHandler = supabase.channel().on.mock.calls.find(
      call => call[0] === 'presence' && call[1].event === 'leave'
    )[2];

    leaveHandler({ key: 'user-1' });

    expect(useUserStore.getState().setUserOffline).toHaveBeenCalledWith('user-1');
  });
}); 