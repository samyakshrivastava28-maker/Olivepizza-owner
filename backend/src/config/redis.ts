/**
 * redis.ts — Authoritative Redis Client & Service Bridge
 * 
 * Provides direct access to the Layerbase / Upstash Redis client and centralized RedisService
 * for distributed locking, caching, and rate limiting.
 */

import { redisService, RedisService } from '../services/redis/RedisService.js';
import type { Redis } from 'ioredis';

export { redisService, RedisService };

/**
 * Returns the underlying raw ioredis Client (or null if unconfigured/fallback mode)
 */
export const getRedisClient = (): Redis | null => {
  return redisService.getClient();
};

export const redisClient = redisService.getClient();

export default redisService;
