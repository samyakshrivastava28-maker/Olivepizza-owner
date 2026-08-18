/**
 * EmbeddingCache — Production LRU In-Memory Cache
 *
 * Caches:
 *  1. Query embedding vectors (avoids repeat NVIDIA/Gemini API calls)
 *  2. Qdrant context results (avoids repeat vector searches for same queries)
 *
 * Includes namespace-based invalidation, TTL expiry, and cache hit ratio tracking.
 */

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  namespace: string;
  hitCount: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRatio: number;
  size: number;
  maxSize: number;
  ttlMs: number;
  namespaces: string[];
}

export class EmbeddingCache {
  private cache = new Map<string, CacheEntry<any>>();
  private maxEntries = 500;
  private ttlMs = 15 * 60 * 1000; // 15 minutes TTL

  // Statistics for developer diagnostics
  private _hits = 0;
  private _misses = 0;

  private buildKey(namespace: string, query: string): string {
    return `${namespace}:${query.trim().toLowerCase().slice(0, 200)}`; // cap key length
  }

  public get<T>(namespace: string, query: string): T | null {
    const key = this.buildKey(namespace, query);
    const entry = this.cache.get(key);

    if (!entry) {
      this._misses++;
      return null;
    }

    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      this._misses++;
      return null;
    }

    // Promote hit: update hit count
    entry.hitCount++;
    this._hits++;
    return entry.value as T;
  }

  public set<T>(namespace: string, query: string, value: T): void {
    const key = this.buildKey(namespace, query);

    // Evict: remove oldest entry if at capacity
    if (this.cache.size >= this.maxEntries) {
      // Find and evict the oldest entry
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      for (const [k, entry] of this.cache.entries()) {
        if (entry.timestamp < oldestTime) {
          oldestTime = entry.timestamp;
          oldestKey = k;
        }
      }
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      namespace,
      hitCount: 0,
    });
  }

  /**
   * Invalidates all cache entries under a specific namespace.
   * Call this when products/coupons are updated in Firestore.
   */
  public invalidate(namespace: string): void {
    let deletedCount = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.namespace === namespace) {
        this.cache.delete(key);
        deletedCount++;
      }
    }
    if (deletedCount > 0) {
      console.log(`[EmbeddingCache] Invalidated ${deletedCount} cache entries for namespace: ${namespace}`);
    }
  }

  /** Clear all namespaces (e.g., on KB rebuild) */
  public clear(): void {
    this.cache.clear();
    this._hits = 0;
    this._misses = 0;
  }

  /** Get cache statistics for developer diagnostics */
  public getStats(): CacheStats {
    const total = this._hits + this._misses;
    const namespaces = [...new Set([...this.cache.values()].map(e => e.namespace))];
    return {
      hits: this._hits,
      misses: this._misses,
      hitRatio: total > 0 ? Math.round((this._hits / total) * 1000) / 10 : 0,
      size: this.cache.size,
      maxSize: this.maxEntries,
      ttlMs: this.ttlMs,
      namespaces,
    };
  }
}

export const embeddingCache = new EmbeddingCache();
