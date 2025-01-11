import { renderHook, act } from '@testing-library/react-hooks';
import { useUserCache } from '../useUserCache';
import { User } from '../../types/models';

describe('useUserCache', () => {
  const mockUser: User = {
    id: 'user1',
    username: 'testuser',
    full_name: 'Test User',
    avatar_url: 'https://example.com/avatar.jpg',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  it('should initialize with default states', () => {
    const { result } = renderHook(() => useUserCache());
    
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should set and get user from cache', () => {
    const { result } = renderHook(() => useUserCache());
    
    act(() => {
      result.current.setUser(mockUser.id, mockUser);
    });

    const cachedUser = result.current.getUser(mockUser.id);
    expect(cachedUser).toEqual(mockUser);
  });

  it('should invalidate user from cache', () => {
    const { result } = renderHook(() => useUserCache());
    
    act(() => {
      result.current.setUser(mockUser.id, mockUser);
      result.current.invalidateUser(mockUser.id);
    });

    const cachedUser = result.current.getUser(mockUser.id);
    expect(cachedUser).toBeNull();
  });

  it('should set user online status', () => {
    const { result } = renderHook(() => useUserCache());
    
    act(() => {
      result.current.setUser(mockUser.id, mockUser);
      result.current.setUserOnline(mockUser.id);
    });

    expect(result.current.isUserOnline(mockUser.id)).toBe(true);
  });

  it('should set user offline status', () => {
    const { result } = renderHook(() => useUserCache());
    
    act(() => {
      result.current.setUser(mockUser.id, mockUser);
      result.current.setUserOnline(mockUser.id);
      result.current.setUserOffline(mockUser.id);
    });

    expect(result.current.isUserOnline(mockUser.id)).toBe(false);
  });

  it('should handle errors when setting online status for non-existent user', () => {
    const { result } = renderHook(() => useUserCache());
    
    act(() => {
      result.current.setUserOnline('non-existent-user');
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toBe('User not found in cache');
  });

  it('should handle errors when setting offline status for non-existent user', () => {
    const { result } = renderHook(() => useUserCache());
    
    act(() => {
      result.current.setUserOffline('non-existent-user');
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toBe('User not found in cache');
  });

  it('should handle errors gracefully', () => {
    const { result } = renderHook(() => useUserCache());
    
    // Simulate an error by passing invalid data
    act(() => {
      result.current.setUser('invalid-id', {} as User);
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toContain('Failed to set user in cache');
  });

  it('should validate user data', () => {
    const { result } = renderHook(() => useUserCache());
    
    // Try to set a user with missing required fields
    const invalidUser = {
      id: 'user1',
      username: 'testuser'
    } as User;
    
    act(() => {
      result.current.setUser(invalidUser.id, invalidUser);
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toContain('Invalid user format');
  });

  it('should update loading state', () => {
    const { result } = renderHook(() => useUserCache());
    
    act(() => {
      result.current.setLoading(true);
    });

    expect(result.current.isLoading).toBe(true);

    act(() => {
      result.current.setLoading(false);
    });

    expect(result.current.isLoading).toBe(false);
  });
}); 