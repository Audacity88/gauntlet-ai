import { Channel } from '@/types/models';
import { DirectMessage } from '@/types/schema';
import { ChannelWithDetails } from './ChannelProcessor';
import { DirectMessageWithDetails } from './DirectMessageProcessor';

export type SearchableItem = {
  id: string;
  type: 'channel' | 'message' | 'direct_message';
  content: string;
  metadata: Record<string, any>;
  timestamp: string;
};

export type SearchFilter = {
  type?: ('channel' | 'message' | 'direct_message')[];
  dateRange?: {
    start: string;
    end: string;
  };
  metadata?: Record<string, any>;
};

export type SearchResult = {
  item: SearchableItem;
  score: number;
  highlights: { field: string; matches: string[] }[];
};

export class SearchProcessor {
  private searchIndex: Map<string, SearchableItem> = new Map();
  private processedIds: Set<string> = new Set();

  constructor() {
    this.searchIndex = new Map();
    this.processedIds = new Set();
  }

  // Index a channel for searching
  indexChannel(channel: ChannelWithDetails): void {
    if (this.processedIds.has(channel.id)) return;

    const searchableItem: SearchableItem = {
      id: channel.id,
      type: 'channel',
      content: `${channel.name} ${channel.description || ''}`,
      metadata: {
        creator: channel.creator?.username,
        type: channel.type,
        memberCount: channel.member_count
      },
      timestamp: channel.created_at
    };

    this.searchIndex.set(channel.id, searchableItem);
    this.processedIds.add(channel.id);
  }

  // Index a message for searching
  indexMessage(message: DirectMessageWithDetails | DirectMessage): void {
    if (this.processedIds.has(message.id)) return;

    const searchableItem: SearchableItem = {
      id: message.id,
      type: 'direct_message' in message ? 'direct_message' : 'message',
      content: message.content,
      metadata: {
        sender: 'sender' in message ? message.sender?.username : undefined,
        receiver: 'receiver' in message ? message.receiver?.username : undefined
      },
      timestamp: message.created_at
    };

    this.searchIndex.set(message.id, searchableItem);
    this.processedIds.add(message.id);
  }

  // Remove an item from the search index
  removeFromIndex(id: string): void {
    this.searchIndex.delete(id);
    this.processedIds.delete(id);
  }

  // Clear the entire search index
  clearIndex(): void {
    this.searchIndex.clear();
    this.processedIds.clear();
  }

  // Search for items with optional filtering
  search(query: string, filter?: SearchFilter): SearchResult[] {
    const results: SearchResult[] = [];
    const searchTerms = query.toLowerCase().split(' ');

    for (const item of this.searchIndex.values()) {
      // Apply filters
      if (filter) {
        if (filter.type && !filter.type.includes(item.type)) continue;
        if (filter.dateRange) {
          const timestamp = new Date(item.timestamp).getTime();
          const start = new Date(filter.dateRange.start).getTime();
          const end = new Date(filter.dateRange.end).getTime();
          if (timestamp < start || timestamp > end) continue;
        }
        if (filter.metadata) {
          const matches = Object.entries(filter.metadata).every(([key, value]) => 
            item.metadata[key] === value
          );
          if (!matches) continue;
        }
      }

      // Calculate search score and collect highlights
      const contentLower = item.content.toLowerCase();
      const metadataString = Object.values(item.metadata)
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      let score = 0;
      const highlights: { field: string; matches: string[] }[] = [];

      // Check content matches
      const contentMatches = searchTerms.filter(term => contentLower.includes(term));
      if (contentMatches.length > 0) {
        score += contentMatches.length * 2;
        highlights.push({ field: 'content', matches: contentMatches });
      }

      // Check metadata matches
      const metadataMatches = searchTerms.filter(term => metadataString.includes(term));
      if (metadataMatches.length > 0) {
        score += metadataMatches.length;
        highlights.push({ field: 'metadata', matches: metadataMatches });
      }

      if (score > 0) {
        results.push({ item, score, highlights });
      }
    }

    // Sort results by score (descending) and timestamp (most recent first)
    return results.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return new Date(b.item.timestamp).getTime() - new Date(a.item.timestamp).getTime();
    });
  }
}

// Create a singleton instance
let searchProcessor: SearchProcessor | null = null;

export function getSearchProcessor(): SearchProcessor {
  if (!searchProcessor) {
    searchProcessor = new SearchProcessor();
  }
  return searchProcessor;
} 