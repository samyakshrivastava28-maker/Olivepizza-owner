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
   * Cached Menu with Firestore Fallback
   * TTL: 5 minutes (300 seconds)
   */
  public async getMenu(branchId = 'main_branch'): Promise<any[]> {
    const cacheKey = `cache:menu:${branchId}`;
    const cached = await this.get<any[]>(cacheKey);
    if (cached) return cached;

    // Fallback to Firestore
    try {
      const snap = await adminDb.collection('products')
        .where('isActive', '==', true)
        .get();

      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      await this.set(cacheKey, items, 300);
      return items;
    } catch (e) {
      console.warn('[RedisService] Firestore menu fetch error:', e);
      return [];
    }
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
   * Cached Store Status (isStoreOpen, isAcceptingOrders) with Firestore Fallback
   * TTL: 1 minute (60 seconds)
   */
  public async getStoreStatus(branchId = 'main_branch'): Promise<{ isOpen: boolean; acceptingOrders: boolean } | null> {
    const cacheKey = `cache:store_status:${branchId}`;
    const cached = await this.get<{ isOpen: boolean; acceptingOrders: boolean }>(cacheKey);
    if (cached) return cached;

    // Fallback to Firestore
    try {
      const doc = await adminDb.collection('branches').doc(branchId).get();
      if (doc.exists) {
        const data = doc.data()!;
        const status = {
          isOpen: data.isOpen !== false,
          acceptingOrders: data.acceptingOrders !== false && data.isAcceptingOrders !== false
        };
        await this.set(cacheKey, status, 60);
        return status;
      }
    } catch {}

    return { isOpen: true, acceptingOrders: true };
  }

  public async invalidateStoreStatus(branchId = 'main_branch'): Promise<void> {
    await this.del(`cache:store_status:${branchId}`);
  }

  /**
   * Cached Franchise Metadata with Firestore Fallback
   * TTL: 10 minutes (600 seconds)
   */
  public async getFranchiseMetadata(franchiseId: string): Promise<any | null> {
    const cacheKey = `cache:franchise:${franchiseId}`;
    const cached = await this.get<any>(cacheKey);
    if (cached) return cached;

    // Fallback to Firestore
    try {
      const doc = await adminDb.collection('franchises').doc(franchiseId).get();
      if (doc.exists) {
        const data = doc.data();
        await this.set(cacheKey, data, 600);
        return data;
      }
    } catch {}

    return null;
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
   */
  public async acquireLock(lockKey: string, ttlSeconds = 10): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      // In disconnected fallback mode, allow operation to proceed
      return true;
    }
    try {
      const result = await this.client.set(`lock:${lockKey}`, '1', 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch {
      return true; // Graceful fallback
    }
  }

  public async releaseLock(lockKey: string): Promise<void> {
    await this.del(`lock:${lockKey}`);
  }
}

export const redisService = new RedisService();
