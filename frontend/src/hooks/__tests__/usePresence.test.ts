import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePresence } from '../usePresence';
import { useAuth } from '../useAuth';
import { useUserStore } from '@/stores/userStore';
import { getPresenceManager } from '@/utils/PresenceManager';

// Mock dependencies
vi.mock('../useAuth', () => ({
  useAuth: vi.fn()
}));

vi.mock('@/stores/userStore', () => ({
  useUserStore: vi.fn()
}));

vi.mock('@/utils/PresenceManager', () => ({
  getPresenceManager: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(true),
    cleanup: vi.fn().mockResolvedValue(undefined),
    updatePresence: vi.fn().mockResolvedValue(undefined)
  }))
}));

describe('usePresence', () => {
  const mockUser = { id: 'test-user' };
  const mockUsers = new Map([
    ['test-user', { id: 'test-user', status: 'ONLINE', last_seen: '2024-01-01T00:00:00Z' }],
    ['offline-user', { id: 'offline-user', status: 'OFFLINE', last_seen: '2024-01-01T00:00:00Z' }]
  ]);
  const mockOnlineUsers = new Set(['test-user']);

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock useAuth
    (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
    
    // Mock useUserStore
    (useUserStore as jest.Mock).mockReturnValue({
      users: mockUsers,
      onlineUsers: mockOnlineUsers
    });
  });

  it('initializes presence manager on mount', () => {
    renderHook(() => usePresence());

    expect(getPresenceManager).toHaveBeenCalledWith(mockUser.id);
    expect(getPresenceManager().initialize).toHaveBeenCalled();
  });

  it('cleans up presence manager on unmount', () => {
    const { unmount } = renderHook(() => usePresence());
    
    unmount();

    expect(getPresenceManager().cleanup).toHaveBeenCalled();
  });

  it('updates user status correctly', async () => {
    const { result } = renderHook(() => usePresence());

    await act(async () => {
      await result.current.updateStatus('AWAY');
    });

    expect(getPresenceManager().updatePresence).toHaveBeenCalledWith('AWAY');
  });

  it('checks online status correctly', () => {
    const { result } = renderHook(() => usePresence());

    expect(result.current.isOnline('test-user')).toBe(true);
    expect(result.current.isOnline('offline-user')).toBe(false);
  });

  it('gets user status correctly', () => {
    const { result } = renderHook(() => usePresence());

    expect(result.current.getUserStatus('test-user')).toBe('ONLINE');
    expect(result.current.getUserStatus('offline-user')).toBe('OFFLINE');
  });

  it('gets last seen timestamp correctly', () => {
    const { result } = renderHook(() => usePresence());

    expect(result.current.getLastSeen('test-user')).toBe('2024-01-01T00:00:00Z');
    expect(result.current.getLastSeen('non-existent-user')).toBe(null);
  });

  it('does not initialize presence manager without user', () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });
    
    renderHook(() => usePresence());

    expect(getPresenceManager).not.toHaveBeenCalled();
  });

  it('handles errors during initialization', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (getPresenceManager as jest.Mock).mockReturnValue({
      initialize: vi.fn().mockRejectedValue(new Error('Failed to initialize')),
      cleanup: vi.fn().mockResolvedValue(undefined)
    });

    renderHook(() => usePresence());

    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to initialize presence:',
      expect.any(Error)
    );
  });

  it('handles errors during cleanup', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (getPresenceManager as jest.Mock).mockReturnValue({
      initialize: vi.fn().mockResolvedValue(true),
      cleanup: vi.fn().mockRejectedValue(new Error('Failed to cleanup'))
    });

    const { unmount } = renderHook(() => usePresence());
    unmount();

    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to cleanup presence:',
      expect.any(Error)
    );
  });
}); 