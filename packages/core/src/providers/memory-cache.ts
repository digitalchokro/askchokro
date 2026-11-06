import type { CacheProvider } from '../interfaces/providers.js';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class InMemoryCacheProvider implements CacheProvider {
  private store = new Map<string, CacheEntry<unknown>>();
  readonly maxEntries: number;

  constructor(maxEntries = 1000) {
    this.maxEntries = maxEntries > 0 ? maxEntries : 1000;
  }

  get size(): number {
    return this.store.size;
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    // Refresh LRU order: re-insert as most recently used
    this.store.delete(key);
    this.store.set(key, entry);

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds = 3600): Promise<void> {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  /**
   * Add one to a counter and return the new value.
   *
   * The expiry is set only when the counter is created, so the window runs a
   * fixed `ttlSeconds` from the first request rather than sliding forward on
   * every hit. Refreshing it per request would let a steady stream of traffic
   * hold the window open indefinitely and never reset the count.
   *
   * There is no await between the read and the write, so this is atomic with
   * respect to other JavaScript on the same event loop. It is per-process:
   * use a Redis-backed cache to rate limit across instances.
   */
  async increment(key: string, ttlSeconds = 3600): Promise<number> {
    const entry = this.store.get(key);
    const now = Date.now();

    if (!entry || now > entry.expiresAt) {
      if (this.store.has(key)) {
        this.store.delete(key);
      } else if (this.store.size >= this.maxEntries) {
        const oldestKey = this.store.keys().next().value;
        if (oldestKey !== undefined) {
          this.store.delete(oldestKey);
        }
      }
      this.store.set(key, { value: 1, expiresAt: now + ttlSeconds * 1000 });
      return 1;
    }

    const next = (typeof entry.value === 'number' ? entry.value : 0) + 1;
    entry.value = next;
    // Refresh LRU order
    this.store.delete(key);
    this.store.set(key, entry);
    return next;
  }
}
