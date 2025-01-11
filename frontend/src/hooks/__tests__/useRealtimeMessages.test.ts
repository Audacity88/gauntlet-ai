import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRealtimeMessages } from '../useRealtimeMessages';
import { useAuth } from '../useAuth';
import { useMessageStore } from '@/stores/messageStore';
import { supabase } from '@/lib/supabaseClient';
import { getMessageProcessor } from '@/utils/MessageProcessor';

// Mock dependencies
vi.mock('../useAuth', () => ({
  useAuth: vi.fn()
}));

vi.mock('@/stores/messageStore', () => ({
  useMessageStore: vi.fn()
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockResolvedValue('SUBSCRIBED'),
      unsubscribe: vi.fn().mockResolvedValue(undefined)
    })),
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null })
    })),
    removeChannel: vi.fn()
  }
}));

vi.mock('@/utils/MessageProcessor', () => ({
  getMessageProcessor: vi.fn(() => ({
    processMessage: vi.fn(),
    processMessages: vi.fn(),
    clearProcessedIds: vi.fn(),
    hasProcessed: vi.fn()
  }))
}));

describe('useRealtimeMessages', () => {
  const mockUser = { id: 'user-1' };
  const mockChannelId = 'channel-1';
  const mockMessages = new Map([
    ['msg-1', { id: 'msg-1', content: 'Test message' }]
  ]);
  const mockOptimisticMessages = new Map();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock useAuth
    (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
    
    // Mock useMessageStore
    (useMessageStore as jest.Mock).mockReturnValue({
      messages: mockMessages,
      optimisticMessages: mockOptimisticMessages,
      addMessage: vi.fn(),
      updateMessage: vi.fn(),
      removeMessage: vi.fn(),
      setMessages: vi.fn(),
      setLoading: vi.fn(),
      setError: vi.fn()
    });
  });

  it('initializes with correct default values', () => {
    const { result } = renderHook(() => useRealtimeMessages({ channelId: mockChannelId }));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.hasMore).toBe(false);
    expect(result.current.messages).toHaveLength(1);
  });

  it('sets up realtime subscription on mount', () => {
    renderHook(() => useRealtimeMessages({ channelId: mockChannelId }));

    expect(supabase.channel).toHaveBeenCalledWith('messages:channel-1');
    expect(supabase.channel().on).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: 'channel_id=eq.channel-1'
      },
      expect.any(Function)
    );
    expect(supabase.channel().subscribe).toHaveBeenCalled();
  });

  it('cleans up subscription on unmount', () => {
    const { unmount } = renderHook(() => useRealtimeMessages({ channelId: mockChannelId }));
    
    unmount();

    expect(getMessageProcessor().clearProcessedIds).toHaveBeenCalled();
    expect(supabase.removeChannel).toHaveBeenCalled();
  });

  it('loads initial messages on mount', async () => {
    const mockData = [{ id: 'msg-1', content: 'Test' }];
    const mockProcessedMessages = [{ id: 'msg-1', content: 'Test', user: mockUser }];

    (supabase.from().select().eq().order().limit as jest.Mock).mockResolvedValueOnce({
      data: mockData,
      error: null
    });

    (getMessageProcessor().processMessages as jest.Mock).mockReturnValueOnce(mockProcessedMessages);

    renderHook(() => useRealtimeMessages({ channelId: mockChannelId }));

    expect(useMessageStore().setLoading).toHaveBeenCalledWith(true);
    expect(getMessageProcessor().processMessages).toHaveBeenCalledWith(mockData);
    expect(useMessageStore().setMessages).toHaveBeenCalledWith(mockProcessedMessages);
  });

  it('handles errors when loading messages', async () => {
    const mockError = new Error('Failed to load messages');

    (supabase.from().select().eq().order().limit as jest.Mock).mockResolvedValueOnce({
      data: null,
      error: mockError
    });

    renderHook(() => useRealtimeMessages({ channelId: mockChannelId }));

    expect(useMessageStore().setError).toHaveBeenCalledWith(mockError);
  });

  it('processes new messages from realtime subscription', async () => {
    const mockNewMessage = { id: 'msg-2', content: 'New message' };
    const mockProcessedMessage = { ...mockNewMessage, user: mockUser };

    (getMessageProcessor().processMessage as jest.Mock).mockReturnValueOnce(mockProcessedMessage);

    renderHook(() => useRealtimeMessages({ channelId: mockChannelId }));

    // Get the subscription handler
    const handler = (supabase.channel().on as jest.Mock).mock.calls[0][2];
    
    // Simulate new message
    await act(async () => {
      handler({ new: mockNewMessage });
    });

    expect(getMessageProcessor().processMessage).toHaveBeenCalledWith(mockNewMessage);
    expect(useMessageStore().addMessage).toHaveBeenCalledWith(mockProcessedMessage);
  });

  it('sends messages correctly', async () => {
    const mockContent = 'Test message';
    const mockResponse = { id: 'msg-3', content: mockContent };

    (supabase.from().insert().select().single as jest.Mock).mockResolvedValueOnce({
      data: mockResponse,
      error: null
    });

    const { result } = renderHook(() => useRealtimeMessages({ channelId: mockChannelId }));

    await act(async () => {
      await result.current.sendMessage(mockContent);
    });

    expect(supabase.from).toHaveBeenCalledWith('messages');
    expect(supabase.from().insert).toHaveBeenCalledWith({
      channel_id: mockChannelId,
      user_id: mockUser.id,
      profile_id: expect.any(String),
      content: mockContent,
      inserted_at: expect.any(String),
      updated_at: expect.any(String)
    });
  });

  it('handles DM channel type correctly', () => {
    renderHook(() => useRealtimeMessages({ 
      channelId: mockChannelId,
      chatType: 'dm'
    }));

    expect(supabase.channel).toHaveBeenCalledWith('direct_messages:channel-1');
    expect(supabase.channel().on).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'direct_messages',
        filter: 'channel_id=eq.channel-1'
      },
      expect.any(Function)
    );
  });
}); 