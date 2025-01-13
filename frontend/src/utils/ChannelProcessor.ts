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
    try {
      // Basic validation
      if (!channel || !channel.id || !channel.created_by) {
        console.warn('Invalid channel data:', channel);
        return null;
      }

      // Skip if already processed and not an update
      if (this.processedIds.has(channel.id) && channel.eventType !== 'UPDATE') {
        return null;
      }

      const processed = this.transformChannel(channel);
      if (processed) {
        this.processedIds.add(channel.id);
      }
      
      return processed;
    } catch (err) {
      console.error('Error processing channel:', err);
      return null;
    }
  }

  processChannels(channels: Channel[]): ChannelWithDetails[] {
    if (!Array.isArray(channels)) {
      console.warn('Invalid channels array:', channels);
      return [];
    }

    return channels
      .map(ch => {
        try {
          return this.transformChannel(ch);
        } catch (err) {
          console.error('Error processing channel in batch:', ch, err);
          return null;
        }
      })
      .filter((ch): ch is ChannelWithDetails => ch !== null);
  }

  private transformChannel(channel: Channel): ChannelWithDetails | null {
    const { getUserById } = this.options;

    // Validate required fields
    if (!channel.id || !channel.created_by) {
      console.warn('Missing required fields in channel:', channel);
      return null;
    }

    const timestamp = new Date().toISOString();

    // Get creator data
    const creator = getUserById(channel.created_by);
    const defaultUser: User = {
      id: channel.created_by,
      username: 'Loading...',
      full_name: 'Loading...',
      avatar_url: null,
      created_at: timestamp,
      updated_at: timestamp,
      status: 'OFFLINE',
      is_online: false
    };

    // Ensure all required fields are present
    const processedChannel: ChannelWithDetails = {
      id: channel.id,
      slug: channel.slug || 'untitled',
      type: channel.type || 'public',
      created_by: channel.created_by,
      created_at: channel.created_at || timestamp,
      updated_at: channel.updated_at || timestamp,
      creator: creator || defaultUser,
      member_count: channel.member_count || 0
    };

    return processedChannel;
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