import { MessageWithUser, Channel, User } from '../../types/models';
import { CacheManager } from './manager';
import { MessageCacheStrategy, ChannelCacheStrategy, UserCacheStrategy } from './strategies';

export class CacheIntegration {
  private messageCache: CacheManager<MessageWithUser>;
  private channelCache: CacheManager<Channel>;
  private userCache: CacheManager<User>;
  private onlineUsers: Set<string>;

  constructor() {
    this.messageCache = new CacheManager({
      expiryTime: 5 * 60 * 1000, // 5 minutes
      maxEntries: 1000,
      strategy: new MessageCacheStrategy()
    });

    this.channelCache = new CacheManager({
      expiryTime: 15 * 60 * 1000, // 15 minutes
      maxEntries: 100,
      strategy: new ChannelCacheStrategy()
    });

    this.userCache = new CacheManager({
      expiryTime: 10 * 60 * 1000, // 10 minutes
      maxEntries: 500,
      strategy: new UserCacheStrategy()
    });

    this.onlineUsers = new Set();
  }

  // Message cache operations
  getMessage(id: string): MessageWithUser | null {
    return this.messageCache.get(id);
  }

  setMessage(id: string, message: MessageWithUser): void {
    this.messageCache.set(id, message);
  }

  invalidateMessage(id: string): void {
    this.messageCache.remove(id);
  }

  invalidateChannelMessages(channelId: string): void {
    this.messageCache.invalidateByTag(`channel:${channelId}`);
  }

  invalidateUserMessages(userId: string): void {
    this.messageCache.invalidateByTag(`user:${userId}`);
  }

  // Channel cache operations
  getChannel(id: string): Channel | null {
    return this.channelCache.get(id);
  }

  setChannel(id: string, channel: Channel): void {
    this.channelCache.set(id, channel);
  }

  invalidateChannel(id: string): void {
    this.channelCache.remove(id);
  }

  invalidateChannelType(type: 'public' | 'private'): void {
    this.channelCache.invalidateByTag(`channel-type:${type}`);
  }

  // User cache operations
  getUser(id: string): User | null {
    return this.userCache.get(id);
  }

  setUser(id: string, user: User): void {
    // Remove old status tag before setting new user
    const oldUser = this.getUser(id);
    if (oldUser) {
      this.userCache.invalidateByTag(`status:${oldUser.is_online ? 'online' : 'offline'}`);
    }
    this.userCache.set(id, user);
  }

  invalidateUser(id: string): void {
    this.userCache.remove(id);
  }

  setUserOnline(userId: string): void {
    const user = this.userCache.get(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    const updatedUser = {
      ...user,
      is_online: true
    };

    this.userCache.set(userId, updatedUser);
    this.onlineUsers.add(userId);
  }

  setUserOffline(userId: string): void {
    const user = this.userCache.get(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }
    
    const updatedUser = {
      ...user,
      is_online: false
    };
    
    this.userCache.set(userId, updatedUser);
    this.onlineUsers.delete(userId);
  }

  isUserOnline(id: string): boolean {
    return this.onlineUsers.has(id);
  }

  // Global operations
  clear(): void {
    this.messageCache.clear();
    this.channelCache.clear();
    this.userCache.clear();
  }

  // Utility methods
  invalidateAttachment(attachmentId: string): void {
    this.messageCache.invalidateByTag(`attachment:${attachmentId}`);
  }

  invalidateCreatorChannels(userId: string): void {
    this.channelCache.invalidateByTag(`creator:${userId}`);
  }
} 