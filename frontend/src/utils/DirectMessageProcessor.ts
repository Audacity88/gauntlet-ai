import { User } from '@/types/models';
import { DirectMessage } from '@/types/schema';

export type DirectMessageWithDetails = DirectMessage & {
  sender?: User;
  receiver?: User;
  last_message?: string;
  unread_count?: number;
};

interface ProcessOptions {
  getUserById: (id: string) => User | undefined;
  currentUserId: string;
}

export class DirectMessageProcessor {
  private processedIds = new Set<string>();

  constructor(private options: ProcessOptions) {}

  processDirectMessage(dm: DirectMessage & { eventType?: 'INSERT' | 'UPDATE' | 'DELETE' }): DirectMessageWithDetails | null {
    if (this.processedIds.has(dm.id)) {
      return null;
    }

    const processed = this.transformDirectMessage(dm);
    this.processedIds.add(dm.id);
    
    return processed;
  }

  processDirectMessages(dms: DirectMessage[]): DirectMessageWithDetails[] {
    return dms
      .map(dm => this.transformDirectMessage(dm))
      .filter((dm): dm is DirectMessageWithDetails => dm !== null);
  }

  private transformDirectMessage(dm: DirectMessage): DirectMessageWithDetails | null {
    const { getUserById, currentUserId } = this.options;
    const timestamp = new Date().toISOString();

    // Get user data
    const sender = getUserById(dm.sender_id);
    const receiver = getUserById(dm.receiver_id);
    const defaultUser: User = {
      id: 'unknown',
      username: 'Loading...',
      full_name: 'Loading...',
      avatar_url: null,
      created_at: timestamp,
      updated_at: timestamp
    };

    // Determine the other user (not the current user)
    const otherUserId = dm.sender_id === currentUserId ? dm.receiver_id : dm.sender_id;
    const otherUser = getUserById(otherUserId) || { ...defaultUser, id: otherUserId };

    return {
      ...dm,
      sender: sender || { ...defaultUser, id: dm.sender_id },
      receiver: receiver || { ...defaultUser, id: dm.receiver_id },
      other_user: otherUser
    };
  }

  clearProcessedIds() {
    this.processedIds.clear();
  }

  hasProcessed(dmId: string): boolean {
    return this.processedIds.has(dmId);
  }
}

// Create a singleton instance
let directMessageProcessor: DirectMessageProcessor | null = null;

export function getDirectMessageProcessor(options: ProcessOptions): DirectMessageProcessor {
  if (!directMessageProcessor || 
      directMessageProcessor.options.currentUserId !== options.currentUserId || 
      directMessageProcessor.options.getUserById !== options.getUserById) {
    directMessageProcessor = new DirectMessageProcessor(options);
  }
  return directMessageProcessor;
} 