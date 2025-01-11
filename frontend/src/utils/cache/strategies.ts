import { MessageWithUser, Channel, User } from '../../types/models';

export interface CacheStrategy<T> {
  shouldCache(key: string, data: T): boolean;
  getExpiryTime(key: string, data: T): number;
  getTags(key: string, data: T): string[];
}

export class MessageCacheStrategy implements CacheStrategy<MessageWithUser> {
  private readonly DEFAULT_EXPIRY = 5 * 60 * 1000; // 5 minutes
  private readonly LONG_EXPIRY = 30 * 60 * 1000;   // 30 minutes
  private readonly MAX_MESSAGE_LENGTH = 10000;      // 10KB

  shouldCache(key: string, message: MessageWithUser): boolean {
    // Always cache messages with attachments
    if (message.attachments && message.attachments.length > 0) {
      return true;
    }

    // Don't cache extremely long messages without attachments
    if (message.content.length > this.MAX_MESSAGE_LENGTH) {
      return false;
    }

    return true;
  }

  getExpiryTime(key: string, message: MessageWithUser): number {
    // Keep messages with attachments cached longer
    if (message.attachments?.length) {
      return this.LONG_EXPIRY;
    }

    return this.DEFAULT_EXPIRY;
  }

  getTags(key: string, message: MessageWithUser): string[] {
    const tags = [
      `message:${message.id}`,
      `channel:${message.channel_id}`,
      `user:${message.user_id}`
    ];

    // Add tag for each attachment
    message.attachments?.forEach(attachment => {
      tags.push(`attachment:${attachment.id}`);
    });

    return tags;
  }
}

export class ChannelCacheStrategy implements CacheStrategy<Channel> {
  private readonly DEFAULT_EXPIRY = 15 * 60 * 1000;  // 15 minutes
  private readonly PUBLIC_EXPIRY = 30 * 60 * 1000;   // 30 minutes

  shouldCache(key: string, channel: Channel): boolean {
    return true;
  }

  getExpiryTime(key: string, channel: Channel): number {
    // Keep public channels cached longer as they change less frequently
    if (channel.type === 'public') {
      return this.PUBLIC_EXPIRY;
    }

    return this.DEFAULT_EXPIRY;
  }

  getTags(key: string, channel: Channel): string[] {
    return [
      `channel:${channel.id}`,
      `channel-type:${channel.type}`,
      `creator:${channel.created_by}`
    ];
  }
}

export class UserCacheStrategy implements CacheStrategy<User> {
  private readonly DEFAULT_EXPIRY = 10 * 60 * 1000;  // 10 minutes
  private readonly OFFLINE_EXPIRY = 30 * 60 * 1000;  // 30 minutes

  shouldCache(key: string, user: User): boolean {
    return true;
  }

  getExpiryTime(key: string, user: User): number {
    // Cache offline users longer as their data changes less frequently
    if (user.is_online === false) {
      return this.OFFLINE_EXPIRY;
    }

    return this.DEFAULT_EXPIRY;
  }

  getTags(key: string, user: User): string[] {
    const tags = [`user:${user.id}`];

    // Add online status tag for easier invalidation
    if (user.is_online) {
      tags.push('status:online');
    } else {
      tags.push('status:offline');
    }

    return tags;
  }
} 