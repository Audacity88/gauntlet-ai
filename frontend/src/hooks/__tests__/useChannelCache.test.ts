import { renderHook, act } from '@testing-library/react-hooks';
import { useChannelCache } from '../useChannelCache';
import { Channel } from '../../types/models';

describe('useChannelCache', () => {
  const mockChannel: Channel = {
    id: 'channel1',
    slug: 'general',
    type: 'public',
    created_by: 'user1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  it('should initialize with default states', () => {
    const { result } = renderHook(() => useChannelCache());
    
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should set and get channel from cache', () => {
    const { result } = renderHook(() => useChannelCache());
    
    act(() => {
      result.current.setChannel(mockChannel.id, mockChannel);
    });

    const cachedChannel = result.current.getChannel(mockChannel.id);
    expect(cachedChannel).toEqual(mockChannel);
  });

  it('should invalidate channel from cache', () => {
    const { result } = renderHook(() => useChannelCache());
    
    act(() => {
      result.current.setChannel(mockChannel.id, mockChannel);
      result.current.invalidateChannel(mockChannel.id);
    });

    const cachedChannel = result.current.getChannel(mockChannel.id);
    expect(cachedChannel).toBeNull();
  });

  it('should invalidate channels by type', () => {
    const { result } = renderHook(() => useChannelCache());
    
    act(() => {
      result.current.setChannel(mockChannel.id, mockChannel);
      result.current.invalidateChannelType('public');
    });

    const cachedChannel = result.current.getChannel(mockChannel.id);
    expect(cachedChannel).toBeNull();
  });

  it('should invalidate creator channels', () => {
    const { result } = renderHook(() => useChannelCache());
    
    act(() => {
      result.current.setChannel(mockChannel.id, mockChannel);
      result.current.invalidateCreatorChannels(mockChannel.created_by);
    });

    const cachedChannel = result.current.getChannel(mockChannel.id);
    expect(cachedChannel).toBeNull();
  });

  it('should handle errors gracefully', () => {
    const { result } = renderHook(() => useChannelCache());
    
    // Simulate an error by passing invalid data
    act(() => {
      result.current.setChannel('invalid-id', {} as Channel);
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toContain('Failed to set channel in cache');
  });

  it('should validate channel type', () => {
    const { result } = renderHook(() => useChannelCache());
    
    // Try to set a channel with invalid type
    const invalidChannel = {
      ...mockChannel,
      type: 'invalid' as 'public' | 'private'
    };
    
    act(() => {
      result.current.setChannel(invalidChannel.id, invalidChannel);
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toContain('Invalid channel format');
  });

  it('should update loading state', () => {
    const { result } = renderHook(() => useChannelCache());
    
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