import { CacheManager } from '../cache';

describe('Cache Manager', () => {
  let cache: CacheManager<any>;
  const ONE_SECOND = 1000;

  beforeEach(() => {
    jest.useFakeTimers();
    cache = new CacheManager({ expiryTime: ONE_SECOND });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Basic operations', () => {
    it('stores and retrieves data correctly', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('returns null for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeNull();
    });

    it('correctly reports if key exists', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('removes entries correctly', () => {
      cache.set('key1', 'value1');
      cache.remove('key1');
      expect(cache.get('key1')).toBeNull();
    });

    it('clears all entries correctly', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      expect(cache.size()).toBe(0);
    });
  });

  describe('Expiry behavior', () => {
    it('expires entries after specified time', () => {
      cache.set('key1', 'value1');
      
      // Advance time just before expiry
      jest.advanceTimersByTime(ONE_SECOND - 1);
      expect(cache.get('key1')).toBe('value1');
      
      // Advance time to expiry
      jest.advanceTimersByTime(1);
      expect(cache.get('key1')).toBeNull();
    });

    it('removes expired entries when checking size', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      expect(cache.size()).toBe(2);
      
      jest.advanceTimersByTime(ONE_SECOND + 1);
      expect(cache.size()).toBe(0);
    });

    it('removes expired entries when checking existence', () => {
      cache.set('key1', 'value1');
      
      jest.advanceTimersByTime(ONE_SECOND + 1);
      expect(cache.has('key1')).toBe(false);
      expect(cache.size()).toBe(0);
    });
  });

  describe('Tag-based operations', () => {
    it('associates entries with tags correctly', () => {
      cache.set('key1', 'value1', ['tag1']);
      cache.set('key2', 'value2', ['tag1', 'tag2']);
      cache.set('key3', 'value3', ['tag2']);
      
      cache.invalidateByTag('tag1');
      
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
      expect(cache.get('key3')).toBe('value3');
    });

    it('cleans up tag mappings when removing entries', () => {
      cache.set('key1', 'value1', ['tag1']);
      cache.remove('key1');
      
      // Set a new entry with the same tag
      cache.set('key2', 'value2', ['tag1']);
      expect(cache.get('key2')).toBe('value2');
    });

    it('handles multiple tags per entry correctly', () => {
      cache.set('key1', 'value1', ['tag1', 'tag2', 'tag3']);
      
      cache.invalidateByTag('tag2');
      expect(cache.get('key1')).toBeNull();
    });
  });

  describe('Capacity management', () => {
    it('respects maximum entries limit', () => {
      const limitedCache = new CacheManager<string>({ 
        expiryTime: ONE_SECOND,
        maxEntries: 2
      });
      
      limitedCache.set('key1', 'value1');
      limitedCache.set('key2', 'value2');
      limitedCache.set('key3', 'value3');
      
      expect(limitedCache.size()).toBe(2);
      expect(limitedCache.get('key1')).toBeNull();
      expect(limitedCache.get('key3')).toBe('value3');
    });

    it('removes oldest entries when at capacity', () => {
      const limitedCache = new CacheManager<string>({ 
        expiryTime: ONE_SECOND,
        maxEntries: 2
      });
      
      limitedCache.set('key1', 'value1');
      jest.advanceTimersByTime(100);
      limitedCache.set('key2', 'value2');
      jest.advanceTimersByTime(100);
      limitedCache.set('key3', 'value3');
      
      expect(limitedCache.get('key1')).toBeNull();
      expect(limitedCache.get('key2')).toBe('value2');
      expect(limitedCache.get('key3')).toBe('value3');
    });
  });
}); 