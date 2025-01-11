import { User, Message, MessageWithUser, DirectMessage, DirectMessageWithUser, MessageAttachment } from '../types/models';

export type MessageType = 'channel' | 'dm';
export type AnyMessage = MessageWithUser | DirectMessageWithUser;
export type RawMessage = Message | DirectMessage;

interface ProcessOptions {
  chatType: MessageType;
  getUserById: (id: string) => User | undefined;
}

export class MessageProcessor {
  private processedIds = new Set<string>();

  constructor(private options: ProcessOptions) {}

  processMessage(message: RawMessage & { eventType?: 'INSERT' | 'UPDATE' | 'DELETE' }): AnyMessage | null {
    if (this.processedIds.has(message.id)) {
      return null;
    }

    const processed = this.transformMessage(message);
    this.processedIds.add(message.id);
    
    return processed;
  }

  processMessages(messages: RawMessage[]): AnyMessage[] {
    return messages
      .map(msg => this.transformMessage(msg))
      .filter((msg): msg is AnyMessage => msg !== null);
  }

  private transformMessage(message: RawMessage): AnyMessage | null {
    const { chatType, getUserById } = this.options;
    const timestamp = new Date().toISOString();

    // Handle attachments
    const attachments = message.attachments 
      ? (typeof message.attachments === 'string' 
          ? JSON.parse(message.attachments) 
          : message.attachments)
      : [];

    // Get user data
    const messageUser = getUserById(message.user_id);
    const defaultUser: User = {
      id: message.user_id,
      username: 'Loading...',
      full_name: 'Loading...',
      avatar_url: null,
      created_at: timestamp,
      updated_at: timestamp
    };

    // Create consistent message object
    return {
      id: message.id,
      channel_id: message.channel_id,
      user_id: message.user_id,
      profile_id: message.profile_id,
      content: 'content' in message ? message.content : message.message,
      message: 'message' in message ? message.message : message.content,
      created_at: chatType === 'dm' ? message.created_at || timestamp : undefined,
      inserted_at: chatType === 'channel' ? message.inserted_at || timestamp : undefined,
      updated_at: message.updated_at || timestamp,
      attachments,
      user: messageUser || defaultUser,
      profile: messageUser || defaultUser
    } as AnyMessage;
  }

  clearProcessedIds() {
    this.processedIds.clear();
  }

  hasProcessed(messageId: string): boolean {
    return this.processedIds.has(messageId);
  }
}

// Create a singleton instance
let messageProcessor: MessageProcessor | null = null;

export function getMessageProcessor(options: ProcessOptions): MessageProcessor {
  if (!messageProcessor || 
      messageProcessor.options.chatType !== options.chatType || 
      messageProcessor.options.getUserById !== options.getUserById) {
    messageProcessor = new MessageProcessor(options);
  }
  return messageProcessor;
} 