/**
 * RedisService.ts — Resilient Redis In-Memory Caching & Distributed Locking Engine
 * 
 * CORE ARCHITECTURAL INVARIANTS:
 * 1. Redis is STRICTLY an ephemeral caching and rate-limiting acceleration layer.
 * 2. It is NEVER the authoritative source of truth (Firestore/Postgres are sources of truth).
 * 3. Graceful degradation: If Redis is disconnected, down, or fails, the application
 *    transparently falls back to Firestore without throwing or breaking customer orders.
 */

import { Redis } from 'ioredis';
import { adminDb } from '../../config/firebase.js';

class RedisService {
  private client: Redis | null = null;
  private isConnected = false;
  private connectAttempted = false;

  constructor() {
    this.initClient();
  }

  private initClient() {
    const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;
    
    if (!redisUrl && process.env.NODE_ENV === 'test') {
      console.log('[RedisService] No REDIS_URL provided in test environment — operating in resilient fallback mode.');
      return;
    }

    try {
      this.connectAttempted = true;
      const url = redisUrl || 'redis://localhost:6379';
      this.client = new Redis(url, {
        maxRetriesPerRequest: 1,
        connectTimeout: 3000,
        enableOfflineQueue: false,
        retryStrategy: (times) => {
          if (times > 3) {
            return null; // Stop retrying after 3 attempts, degrade gracefully
          }
          return Math.min(times * 1000, 3000);
        }
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        console.log('[RedisService] ✅ Connected to Redis server.');
      });

      this.client.on('ready', () => {
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        // Do not spam console if Redis is simply not present locally
        if ((err as any).code === 'ECONNREFUSED' || (err as any).code === 'ENOTFOUND') {
          // Log only once
          if (this.connectAttempted) {
            console.warn('[RedisService] ⚠️ Redis unavailable. Graceful fallback to Firestore active.');
            this.connectAttempted = false;
          }
        } else {
          console.warn('[RedisService] Redis notice:', err.message);
        }
      });

      this.client.on('close', () => {
        this.isConnected = false;
      });
    } catch (e: any) {
      console.warn('[RedisService] Failed to initialize Redis client, using Firestore fallback:', e.message);
      this.client = null;
      this.isConnected = false;
    }
  }

  public getStatus(): { isConnected: boolean; configured: boolean } {
    return {
      isConnected: this.isConnected,
      configured: Boolean(process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL)
    };
  }

  public getClient(): Redis | null {
    return this.client;
  }

  public async ping(): Promise<boolean> {
    if (!this.client) return false;
    try {
      const res = await this.client.ping();
      return res === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Generic get cache with TTL
   */
  public async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected || !this.client) return null;
    try {
      const data = await this.client.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }

  /**
   * Generic set cache with TTL in seconds
   */
  public async set(key: string, value: any, ttlSeconds = 300): Promise<void> {
    if (!this.isConnected || !this.client) return;
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      // Non-fatal cache write error
    }
  }

  /**
   * Generic delete cache
   */
  public async del(key: string): Promise<void> {
    if (!this.isConnected || !this.client) return;
    try {
      await this.client.del(key);
    } catch {
      // Non-fatal
    }
  }

  /**
  /**
   * Fetch with Cache Stampede Protection (Distributed Mutex Lock + TTL Jitter + Retry Backoff)
   * Prevents dog-piling and simultaneous backend load when cached hot-keys expire.
   */
  public async fetchWithStampedeProtection<T>(
    cacheKey: string,
    loader: () => Promise<T>,
    options?: {
      ttlSeconds?: number;
      jitterSeconds?: number;
      lockTimeoutSeconds?: number;
      maxRetries?: number;
      retryDelayMs?: number;
    }
  ): Promise<T> {
    const baseTtl = options?.ttlSeconds ?? 300;
    const jitter = options?.jitterSeconds ?? 30;
    const lockTtl = options?.lockTimeoutSeconds ?? 10;
    const maxRetries = options?.maxRetries ?? 5;
    const retryDelay = options?.retryDelayMs ?? 80;

    // 1. Try reading from cache first
    const cached = await this.get<T>(cacheKey);
    if (cached !== null && cached !== undefined) {
      return cached;
    }

    // If Redis is not connected, gracefully execute loader directly
    if (!this.isConnected || !this.client) {
      return await loader();
    }

    // 2. Try acquiring distributed mutex lock
    const lockKey = `stampede:${cacheKey}`;
    const acquired = await this.acquireLock(lockKey, lockTtl, false);

    if (acquired) {
      try {
        // Double-check cache after acquiring lock
        const doubleCheck = await this.get<T>(cacheKey);
        if (doubleCheck !== null && doubleCheck !== undefined) {
          return doubleCheck;
        }

        // Execute authoritative loader
        const freshData = await loader();

        // Calculate TTL with random jitter to prevent synchronized expiration
        const effectiveTtl = baseTtl + Math.floor(Math.random() * jitter);
        await this.set(cacheKey, freshData, effectiveTtl);

        return freshData;
      } finally {
        await this.releaseLock(lockKey);
      }
    }

    // 3. Lock was NOT acquired — another worker is actively refreshing the cache.
    // Poll cache with backoff before falling back.
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay * attempt));
      const retryCached = await this.get<T>(cacheKey);
      if (retryCached !== null && retryCached !== undefined) {
        return retryCached;
      }
    }

    // Fallback: If lock holder timed out, execute loader directly
    return await loader();
  }

  /**
   * Cached Menu with Cache Stampede Protection & Firestore Fallback
   * Base TTL: 5 minutes (300 seconds) + jitter
   */
  public async getMenu(branchId = 'main_branch'): Promise<any[]> {
    const cacheKey = `cache:menu:${branchId}`;
    return this.fetchWithStampedeProtection<any[]>(
      cacheKey,
      async () => {
        try {
          const snap = await adminDb.collection('products')
            .where('isActive', '==', true)
            .get();
          return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e: any) {
          console.warn('[RedisService] Firestore menu fetch error:', e?.message);
          return [];
        }
      },
      { ttlSeconds: 300, jitterSeconds: 30 }
    );
  }

  public async invalidateMenu(branchId?: string): Promise<void> {
    if (branchId) {
      await this.del(`cache:menu:${branchId}`);
    } else {
      // Invalidate all branch menus
      if (this.isConnected && this.client) {
        try {
          const keys = await this.client.keys('cache:menu:*');
          if (keys.length > 0) await this.client.del(...keys);
        } catch {}
      }
    }
  }

  /**
   * Cached Store Status (isStoreOpen, isAcceptingOrders) with Stampede Protection
   * Base TTL: 1 minute (60 seconds) + jitter
   */
  public async getStoreStatus(branchId = 'main_branch'): Promise<{ isOpen: boolean; acceptingOrders: boolean } | null> {
    const cacheKey = `cache:store_status:${branchId}`;
    return this.fetchWithStampedeProtection<{ isOpen: boolean; acceptingOrders: boolean }>(
      cacheKey,
      async () => {
        try {
          const doc = await adminDb.collection('branches').doc(branchId).get();
          if (doc.exists) {
            const data = doc.data()!;
            return {
              isOpen: data.isOpen !== false,
              acceptingOrders: data.acceptingOrders !== false && data.isAcceptingOrders !== false
            };
          }
        } catch {}
        return { isOpen: true, acceptingOrders: true };
      },
      { ttlSeconds: 60, jitterSeconds: 15 }
    );
  }

  public async invalidateStoreStatus(branchId = 'main_branch'): Promise<void> {
    await this.del(`cache:store_status:${branchId}`);
  }

  /**
   * Cached Franchise Metadata with Stampede Protection
   * Base TTL: 10 minutes (600 seconds) + jitter
   */
  public async getFranchiseMetadata(franchiseId: string): Promise<any | null> {
    const cacheKey = `cache:franchise:${franchiseId}`;
    return this.fetchWithStampedeProtection<any | null>(
      cacheKey,
      async () => {
        try {
          const doc = await adminDb.collection('franchises').doc(franchiseId).get();
          if (doc.exists) {
            return doc.data();
          }
        } catch {}
        return null;
      },
      { ttlSeconds: 600, jitterSeconds: 60 }
    );
  }

  public async invalidateFranchiseMetadata(franchiseId?: string): Promise<void> {
    if (franchiseId) {
      await this.del(`cache:franchise:${franchiseId}`);
    } else {
      if (this.isConnected && this.client) {
        try {
          const keys = await this.client.keys('cache:franchise:*');
          if (keys.length > 0) await this.client.del(...keys);
        } catch {}
      }
    }
  }

  /**
   * Distributed Lock Helper with TTL (Prevents concurrent race conditions)
   * @param lockKey Unique lock identifier
   * @param ttlSeconds Lock duration in seconds (default 10)
   * @param failClosed If true, fails closed (returns false) if Redis is disconnected or errors out, preventing concurrent execution in high-risk flows.
   */
  public async acquireLock(lockKey: string, ttlSeconds = 10, failClosed = false): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      if (failClosed) {
        console.warn(`[RedisService] Critical lock "${lockKey}" rejected: Redis is disconnected (fail-closed).`);
        return false;
      }
      return true;
    }
    try {
      const result = await this.client.set(`lock:${lockKey}`, '1', 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch (err: any) {
      if (failClosed) {
        console.error(`[RedisService] Critical lock "${lockKey}" error: ${err.message} (fail-closed).`);
        return false;
      }
      return true; // Graceful fallback for non-critical operations
    }
  }

  public async releaseLock(lockKey: string): Promise<void> {
    await this.del(`lock:${lockKey}`);
  }

  public async disconnect(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      try {
        this.client.disconnect();
      } catch {}
    }
  }
}

export { RedisService };
export const redisService = new RedisService();
