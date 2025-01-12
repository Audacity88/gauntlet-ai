import { z } from 'zod';
import { UUID, Timestamp, TimestampFields, BaseEntity } from './base';
import { UserStatus } from '../utils/PresenceManager';

// Base schemas for common fields
export const timestampSchema = z.object({
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  inserted_at: z.string().datetime().optional()
});

export const baseEntitySchema = timestampSchema.extend({
  id: z.string().uuid()
});

// Message types and schemas
export interface BaseMessage extends BaseEntity {
  channel_id: UUID;
  user_id: UUID;
  content: string;
  attachments?: MessageAttachment[];
}

export const baseMessageSchema = baseEntitySchema.extend({
  channel_id: z.string().uuid(),
  user_id: z.string().uuid(),
  content: z.string().min(1, 'Message content cannot be empty'),
  attachments: z.array(z.lazy(() => messageAttachmentSchema)).optional()
});

// Channel types and schemas
export interface Channel extends BaseEntity {
  slug: string;
  created_by: UUID;
  type: 'public' | 'private';
}

export const channelSchema = baseEntitySchema.extend({
  slug: z.string().min(1).max(50),
  created_by: z.string().uuid(),
  type: z.enum(['public', 'private'])
});

// User types and schemas
export interface User {
  id: UUID;
  username: string;
  full_name: string;
  avatar_url: string | null;
  email?: string | undefined;
  is_online?: boolean;
  status?: UserStatus;
  last_seen?: string;
  created_at: Timestamp;
  updated_at: Timestamp;
  inserted_at?: Timestamp;
}

export const userSchema = baseEntitySchema.extend({
  username: z.string().min(3).max(30),
  full_name: z.string().min(1).max(100),
  avatar_url: z.string().url().nullable(),
  email: z.string().email().optional(),
  is_online: z.boolean().optional(),
  status: z.enum(['ONLINE', 'OFFLINE', 'AWAY', 'BUSY']).optional(),
  last_seen: z.string().datetime().optional()
});

// Message attachment types and schemas
export interface MessageAttachment extends BaseEntity {
  message_id: UUID;
  filename: string;
  file_path: string;
  content_type: string;
  size: number;
  url: string;
}

export const messageAttachmentSchema = baseEntitySchema.extend({
  message_id: z.string().uuid(),
  filename: z.string().min(1),
  file_path: z.string().min(1),
  content_type: z.string().min(1),
  size: z.number().positive(),
  url: z.string().url()
});

// Extended types with relationships
export interface MessageWithUser extends BaseMessage {
  user: User;
}

export const messageWithUserSchema = baseMessageSchema.extend({
  user: userSchema
});

export interface ChannelWithDetails extends Channel {
  creator: User;
  last_message?: BaseMessage;
  unread_count?: number;
}

export const channelWithDetailsSchema = channelSchema.extend({
  creator: userSchema,
  last_message: baseMessageSchema.optional(),
  unread_count: z.number().min(0).optional()
});

// Type guards using Zod schemas
export const isMessage = (value: unknown): value is BaseMessage => {
  return baseMessageSchema.safeParse(value).success;
};

export const isUser = (value: unknown): value is User => {
  return userSchema.safeParse(value).success;
};

export const isChannel = (value: unknown): value is Channel => {
  return channelSchema.safeParse(value).success;
};

export const isMessageAttachment = (value: unknown): value is MessageAttachment => {
  return messageAttachmentSchema.safeParse(value).success;
}; 