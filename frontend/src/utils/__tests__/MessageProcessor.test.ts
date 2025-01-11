import { describe, it, expect, beforeEach } from 'vitest';
import { MessageProcessor, getMessageProcessor } from '../MessageProcessor';
import { User } from '@/types/models';
import { Message, DirectMessage } from '@/types/schema';

describe('MessageProcessor', () => {
  const mockUser: User = {
    id: 'user-1',
    username: 'testuser',
    full_name: 'Test User',
    avatar_url: 'https://example.com/avatar.jpg',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  };

  const mockGetUserById = (id: string) => id === 'user-1' ? mockUser : undefined;

  const mockChannelMessage: Message = {
    id: 'msg-1',
    channel_id: 'channel-1',
    user_id: 'user-1',
    profile_id: 'profile-1',
    content: 'Test message',
    inserted_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    attachments: []
  };

  const mockDirectMessage: DirectMessage = {
    id: 'dm-1',
    channel_id: 'dm-channel-1',
    user_id: 'user-1',
    profile_id: 'profile-1',
    message: 'Test DM',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    attachments: []
  };

  let channelProcessor: MessageProcessor;
  let dmProcessor: MessageProcessor;

  beforeEach(() => {
    channelProcessor = new MessageProcessor({
      chatType: 'channel',
      getUserById: mockGetUserById
    });

    dmProcessor = new MessageProcessor({
      chatType: 'dm',
      getUserById: mockGetUserById
    });
  });

  describe('processMessage', () => {
    it('processes a channel message correctly', () => {
      const processed = channelProcessor.processMessage(mockChannelMessage);

      expect(processed).toEqual({
        ...mockChannelMessage,
        message: mockChannelMessage.content,
        created_at: undefined,
        user: mockUser,
        profile: mockUser
      });
    });

    it('processes a direct message correctly', () => {
      const processed = dmProcessor.processMessage(mockDirectMessage);

      expect(processed).toEqual({
        ...mockDirectMessage,
        content: mockDirectMessage.message,
        inserted_at: undefined,
        user: mockUser,
        profile: mockUser
      });
    });

    it('handles missing user data', () => {
      const messageWithUnknownUser = {
        ...mockChannelMessage,
        user_id: 'unknown-user'
      };

      const processed = channelProcessor.processMessage(messageWithUnknownUser);

      expect(processed?.user).toEqual({
        id: 'unknown-user',
        username: 'Loading...',
        full_name: 'Loading...',
        avatar_url: null,
        created_at: expect.any(String),
        updated_at: expect.any(String)
      });
    });

    it('skips already processed messages', () => {
      const first = channelProcessor.processMessage(mockChannelMessage);
      const second = channelProcessor.processMessage(mockChannelMessage);

      expect(first).toBeTruthy();
      expect(second).toBeNull();
    });

    it('handles string attachments', () => {
      const messageWithStringAttachments = {
        ...mockChannelMessage,
        attachments: JSON.stringify([{ url: 'test.jpg' }])
      };

      const processed = channelProcessor.processMessage(messageWithStringAttachments);

      expect(processed?.attachments).toEqual([{ url: 'test.jpg' }]);
    });
  });

  describe('processMessages', () => {
    it('processes multiple messages correctly', () => {
      const messages = [mockChannelMessage, { ...mockChannelMessage, id: 'msg-2' }];
      const processed = channelProcessor.processMessages(messages);

      expect(processed).toHaveLength(2);
      expect(processed[0].id).toBe('msg-1');
      expect(processed[1].id).toBe('msg-2');
    });
  });

  describe('clearProcessedIds', () => {
    it('allows reprocessing after clearing', () => {
      const first = channelProcessor.processMessage(mockChannelMessage);
      channelProcessor.clearProcessedIds();
      const second = channelProcessor.processMessage(mockChannelMessage);

      expect(first).toBeTruthy();
      expect(second).toBeTruthy();
    });
  });

  describe('getMessageProcessor', () => {
    it('returns the same instance for same options', () => {
      const options = { chatType: 'channel' as const, getUserById: mockGetUserById };
      const processor1 = getMessageProcessor(options);
      const processor2 = getMessageProcessor(options);

      expect(processor1).toBe(processor2);
    });

    it('returns new instance for different options', () => {
      const processor1 = getMessageProcessor({
        chatType: 'channel',
        getUserById: mockGetUserById
      });

      const processor2 = getMessageProcessor({
        chatType: 'dm',
        getUserById: mockGetUserById
      });

      expect(processor1).not.toBe(processor2);
    });
  });
}); 