import { CacheStrategy } from './strategies';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  tags?: string[];
}

export interface CacheOptions<T> {
  expiryTime: number;  // in milliseconds
  maxEntries?: number;
  strategy?: CacheStrategy<T>;
}

export class CacheManager<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly expiryTime: number;
  private readonly maxEntries?: number;
  private readonly strategy?: CacheStrategy<T>;
  private tagMap = new Map<string, Set<string>>();

  constructor(options: CacheOptions<T>) {
    this.expiryTime = options.expiryTime;
    this.maxEntries = options.maxEntries;
    this.strategy = options.strategy;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry || this.isExpired(entry)) {
      if (entry) {
        this.remove(key);
      }
      return null;
    }
    return entry.data;
  }

  set(key: string, data: T): void {
    // Check if we should cache this data using strategy
    if (this.strategy && !this.strategy.shouldCache(key, data)) {
      return;
    }

    // Remove oldest entry if we're at capacity
    if (this.maxEntries && this.cache.size >= this.maxEntries) {
      const oldestKey = this.findOldestEntry();
      if (oldestKey) {
        this.remove(oldestKey);
      }
    }

    // Get expiry time and tags from strategy if available
    const expiryTime = this.strategy?.getExpiryTime(key, data) ?? this.expiryTime;
    const tags = this.strategy?.getTags(key, data) ?? [];

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      tags
    };

    this.cache.set(key, entry);
    
    // Update tag mappings
    tags.forEach(tag => {
      if (!this.tagMap.has(tag)) {
        this.tagMap.set(tag, new Set());
      }
      this.tagMap.get(tag)?.add(key);
    });
  }

  remove(key: string): void {
    const entry = this.cache.get(key);
    if (entry?.tags) {
      // Remove key from all tag sets
      entry.tags.forEach(tag => {
        this.tagMap.get(tag)?.delete(key);
        // Clean up empty tag sets
        if (this.tagMap.get(tag)?.size === 0) {
          this.tagMap.delete(tag);
        }
      });
    }
    this.cache.delete(key);
  }

  invalidateByTag(tag: string): void {
    const keys = this.tagMap.get(tag);
    if (keys) {
      keys.forEach(key => this.remove(key));
    }
    this.tagMap.delete(tag);
  }

  clear(): void {
    this.cache.clear();
    this.tagMap.clear();
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry || this.isExpired(entry)) {
      if (entry) {
        this.remove(key);
      }
      return false;
    }
    return true;
  }

  size(): number {
    this.removeExpiredEntries();
    return this.cache.size;
  }

  private isExpired(entry: CacheEntry<T>): boolean {
    const now = Date.now();
    const age = now - entry.timestamp;
    return age >= this.expiryTime;
  }

  private findOldestEntry(): string | null {
    let oldestKey: string | null = null;
    let oldestTimestamp = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  private removeExpiredEntries(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp >= this.expiryTime) {
        this.remove(key);
      }
    }
  }
} 