import { renderHook, act } from '@testing-library/react-hooks';
import { useMessageCache } from '../useMessageCache';
import { MessageWithUser } from '../../types/models';

describe('useMessageCache', () => {
  const mockMessage: MessageWithUser = {
    id: 'msg1',
    content: 'Test message',
    channel_id: 'channel1',
    user_id: 'user1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user: {
      id: 'user1',
      username: 'testuser',
      full_name: 'Test User',
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_online: true
    }
  };

  it('should initialize with default states', () => {
    const { result } = renderHook(() => useMessageCache());
    
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should set and get message from cache', () => {
    const { result } = renderHook(() => useMessageCache());
    
    act(() => {
      result.current.setMessage(mockMessage.id, mockMessage);
    });

    const cachedMessage = result.current.getMessage(mockMessage.id);
    expect(cachedMessage).toEqual(mockMessage);
  });

  it('should invalidate message from cache', () => {
    const { result } = renderHook(() => useMessageCache());
    
    act(() => {
      result.current.setMessage(mockMessage.id, mockMessage);
      result.current.invalidateMessage(mockMessage.id);
    });

    const cachedMessage = result.current.getMessage(mockMessage.id);
    expect(cachedMessage).toBeNull();
  });

  it('should invalidate channel messages', () => {
    const { result } = renderHook(() => useMessageCache());
    
    act(() => {
      result.current.setMessage(mockMessage.id, mockMessage);
      result.current.invalidateChannelMessages(mockMessage.channel_id);
    });

    const cachedMessage = result.current.getMessage(mockMessage.id);
    expect(cachedMessage).toBeNull();
  });

  it('should invalidate user messages', () => {
    const { result } = renderHook(() => useMessageCache());
    
    act(() => {
      result.current.setMessage(mockMessage.id, mockMessage);
      result.current.invalidateUserMessages(mockMessage.user_id);
    });

    const cachedMessage = result.current.getMessage(mockMessage.id);
    expect(cachedMessage).toBeNull();
  });

  it('should handle errors gracefully', () => {
    const { result } = renderHook(() => useMessageCache());
    
    // Simulate an error by passing invalid data
    act(() => {
      result.current.setMessage('invalid-id', {} as MessageWithUser);
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toContain('Failed to set message in cache');
  });

  it('should update loading state', () => {
    const { result } = renderHook(() => useMessageCache());
    
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