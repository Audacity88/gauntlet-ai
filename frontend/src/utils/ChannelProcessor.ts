import { Channel, User } from '@/types/models';

export type ChannelWithDetails = Channel & {
  creator?: User;
  member_count?: number;
};

interface ProcessOptions {
  getUserById: (id: string) => User | undefined;
}

export class ChannelProcessor {
  private processedIds = new Set<string>();

  constructor(private options: ProcessOptions) {}

  processChannel(channel: Channel & { eventType?: 'INSERT' | 'UPDATE' | 'DELETE' }): ChannelWithDetails | null {
    if (this.processedIds.has(channel.id)) {
      return null;
    }

    const processed = this.transformChannel(channel);
    this.processedIds.add(channel.id);
    
    return processed;
  }

  processChannels(channels: Channel[]): ChannelWithDetails[] {
    return channels
      .map(ch => this.transformChannel(ch))
      .filter((ch): ch is ChannelWithDetails => ch !== null);
  }

  private transformChannel(channel: Channel): ChannelWithDetails | null {
    const { getUserById } = this.options;
    const timestamp = new Date().toISOString();

    // Get creator data
    const creator = getUserById(channel.created_by);
    const defaultUser: User = {
      id: channel.created_by,
      username: 'Loading...',
      full_name: 'Loading...',
      avatar_url: null,
      created_at: timestamp,
      updated_at: timestamp
    };

    return {
      ...channel,
      creator: creator || defaultUser
    };
  }

  clearProcessedIds() {
    this.processedIds.clear();
  }

  hasProcessed(channelId: string): boolean {
    return this.processedIds.has(channelId);
  }
}

// Create a singleton instance
let channelProcessor: ChannelProcessor | null = null;

export function getChannelProcessor(options: ProcessOptions): ChannelProcessor {
  if (!channelProcessor || channelProcessor.options.getUserById !== options.getUserById) {
    channelProcessor = new ChannelProcessor(options);
  }
  return channelProcessor;
} 