import { z } from 'zod';
import {
  baseMessageSchema,
  channelSchema,
  userSchema,
  messageAttachmentSchema,
  messageWithUserSchema,
  channelWithDetailsSchema,
  isMessage,
  isUser,
  isChannel,
  isMessageAttachment
} from '../models';

describe('Model Schemas', () => {
  const validTimestamps = {
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z'
  };

  describe('Message Schema', () => {
    const validMessage = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      channel_id: '123e4567-e89b-12d3-a456-426614174001',
      user_id: '123e4567-e89b-12d3-a456-426614174002',
      content: 'Hello, world!',
      ...validTimestamps
    };

    it('validates correct messages', () => {
      expect(() => baseMessageSchema.parse(validMessage)).not.toThrow();
      expect(isMessage(validMessage)).toBe(true);
    });

    it('rejects invalid messages', () => {
      expect(() => baseMessageSchema.parse({
        ...validMessage,
        id: 'invalid-uuid'
      })).toThrow();

      expect(() => baseMessageSchema.parse({
        ...validMessage,
        content: ''
      })).toThrow();

      expect(isMessage({ ...validMessage, channel_id: 'invalid' })).toBe(false);
    });
  });

  describe('Channel Schema', () => {
    const validChannel = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      slug: 'general',
      created_by: '123e4567-e89b-12d3-a456-426614174001',
      type: 'public',
      ...validTimestamps
    };

    it('validates correct channels', () => {
      expect(() => channelSchema.parse(validChannel)).not.toThrow();
      expect(isChannel(validChannel)).toBe(true);
    });

    it('rejects invalid channels', () => {
      expect(() => channelSchema.parse({
        ...validChannel,
        slug: ''
      })).toThrow();

      expect(() => channelSchema.parse({
        ...validChannel,
        type: 'invalid'
      })).toThrow();

      expect(isChannel({ ...validChannel, created_by: 'invalid' })).toBe(false);
    });
  });

  describe('User Schema', () => {
    const validUser = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      username: 'johndoe',
      full_name: 'John Doe',
      avatar_url: 'https://example.com/avatar.jpg',
      email: 'john@example.com',
      is_online: true,
      ...validTimestamps
    };

    it('validates correct users', () => {
      expect(() => userSchema.parse(validUser)).not.toThrow();
      expect(isUser(validUser)).toBe(true);

      // Test optional fields
      const userWithoutOptionals = {
        id: validUser.id,
        username: validUser.username,
        full_name: validUser.full_name,
        avatar_url: null,
        ...validTimestamps
      };
      expect(() => userSchema.parse(userWithoutOptionals)).not.toThrow();
    });

    it('rejects invalid users', () => {
      expect(() => userSchema.parse({
        ...validUser,
        username: 'a' // too short
      })).toThrow();

      expect(() => userSchema.parse({
        ...validUser,
        email: 'invalid-email'
      })).toThrow();

      expect(isUser({ ...validUser, avatar_url: 'invalid-url' })).toBe(false);
    });
  });

  describe('Message Attachment Schema', () => {
    const validAttachment = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      message_id: '123e4567-e89b-12d3-a456-426614174001',
      filename: 'test.jpg',
      file_path: '/uploads/test.jpg',
      content_type: 'image/jpeg',
      size: 1024,
      url: 'https://example.com/test.jpg',
      ...validTimestamps
    };

    it('validates correct attachments', () => {
      expect(() => messageAttachmentSchema.parse(validAttachment)).not.toThrow();
      expect(isMessageAttachment(validAttachment)).toBe(true);
    });

    it('rejects invalid attachments', () => {
      expect(() => messageAttachmentSchema.parse({
        ...validAttachment,
        size: -1 // must be positive
      })).toThrow();

      expect(() => messageAttachmentSchema.parse({
        ...validAttachment,
        url: 'invalid-url'
      })).toThrow();

      expect(isMessageAttachment({ ...validAttachment, filename: '' })).toBe(false);
    });
  });

  describe('Extended Schemas', () => {
    const validUser = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      username: 'johndoe',
      full_name: 'John Doe',
      avatar_url: null,
      ...validTimestamps
    };

    it('validates MessageWithUser', () => {
      const validMessageWithUser = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        channel_id: '123e4567-e89b-12d3-a456-426614174002',
        user_id: validUser.id,
        content: 'Hello!',
        user: validUser,
        ...validTimestamps
      };

      expect(() => messageWithUserSchema.parse(validMessageWithUser)).not.toThrow();
    });

    it('validates ChannelWithDetails', () => {
      const validChannelWithDetails = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        slug: 'general',
        created_by: validUser.id,
        type: 'public',
        creator: validUser,
        unread_count: 5,
        ...validTimestamps
      };

      expect(() => channelWithDetailsSchema.parse(validChannelWithDetails)).not.toThrow();
    });
  });
}); 