/**
 * RedisOtpService.ts — Production Redis-Backed Atomic OTP Verification Engine
 *
 * Implements:
 * 1. Cryptographically secure code generation (4-digit numeric).
 * 2. Keyed HMAC-SHA256 hash storage at rest (NEVER plaintext codes in Redis).
 * 3. Atomic verification & single-use consumption via Redis Lua script.
 * 4. Strict 5-minute TTL, 60-second resend cooldown, and max 5 verification attempts.
 * 5. Generic responses to prevent account enumeration.
 */

import crypto from 'crypto';
import { redisService } from '../redis/RedisService.js';

export interface OtpGenerationResult {
  success: boolean;
  code?: string;
  expiresInSeconds: number;
  retryAfterSeconds?: number;
  message: string;
}

export interface OtpVerificationResult {
  success: boolean;
  code: 'VERIFIED' | 'INVALID_CODE' | 'EXPIRED' | 'TOO_MANY_ATTEMPTS' | 'SERVICE_ERROR';
  message: string;
  remainingAttempts?: number;
}

export class RedisOtpService {
  private static readonly TTL_SECONDS = 300; // 5 minutes strict expiry
  private static readonly COOLDOWN_SECONDS = 60; // 60 seconds resend cooldown
  private static readonly MAX_ATTEMPTS = 5; // Max 5 verification attempts before invalidation
  private static readonly HMAC_SECRET = process.env.OTP_HMAC_SECRET || process.env.SESSION_SECRET || 'olive-pizza-production-otp-hmac-salt-key-2026';

  // Memory fallback storage for unit tests or when Redis is temporarily offline
  private static memoryFallback = new Map<string, {
    codeHash: string;
    expiresAt: number;
    lastRequestedAt: number;
    attempts: number;
    purpose: string;
    targetApp?: string;
  }>();

  private static getRedisKey(purpose: string, identifier: string): string {
    const cleanId = identifier.trim().toLowerCase();
    return `olive:otp:${purpose}:${cleanId}`;
  }

  private static computeHmac(code: string, identifier: string): string {
    return crypto
      .createHmac('sha256', this.HMAC_SECRET)
      .update(`${identifier.trim().toLowerCase()}:${code}`)
      .digest('hex');
  }

  /**
   * Generates a new secure 4-digit OTP, applies rate limiting and cooldown,
   * and stores the keyed HMAC in Redis with a 5-minute TTL.
   */
  public static async generateOtp(
    identifier: string,
    purpose: string = 'login',
    targetApp?: string
  ): Promise<OtpGenerationResult> {
    const cleanId = identifier.trim().toLowerCase();
    const key = this.getRedisKey(purpose, cleanId);
    const now = Date.now();

    const client = redisService.getClient();

    if (client && redisService.isRedisConnected()) {
      try {
        // Check 60s resend cooldown
        const lastRequestedStr = await client.hget(key, 'lastRequestedAt');
        if (lastRequestedStr) {
          const lastRequested = Number(lastRequestedStr);
          const elapsedSec = Math.floor((now - lastRequested) / 1000);
          if (elapsedSec < this.COOLDOWN_SECONDS) {
            const waitTime = this.COOLDOWN_SECONDS - elapsedSec;
            return {
              success: false,
              expiresInSeconds: 0,
              retryAfterSeconds: waitTime,
              message: `Please wait ${waitTime} seconds before requesting a new code.`
            };
          }
        }

        // Generate 4-digit code (1000-9999)
        const code = crypto.randomInt(1000, 10000).toString();
        const codeHash = this.computeHmac(code, cleanId);
        const expiresAt = now + this.TTL_SECONDS * 1000;

        // Store hash atomically with TTL
        const pipeline = client.pipeline();
        pipeline.hset(key, {
          codeHash,
          expiresAt: String(expiresAt),
          lastRequestedAt: String(now),
          attempts: '0',
          purpose,
          targetApp: targetApp || 'UNKNOWN'
        });
        pipeline.expire(key, this.TTL_SECONDS);
        await pipeline.exec();

        return {
          success: true,
          code,
          expiresInSeconds: this.TTL_SECONDS,
          retryAfterSeconds: this.COOLDOWN_SECONDS,
          message: 'Verification code generated successfully.'
        };
      } catch (err: any) {
        console.warn('[RedisOtpService] Redis write notice, engaging fallback:', err.message);
      }
    }

    // Fallback in-memory handler
    const existing = this.memoryFallback.get(key);
    if (existing && existing.lastRequestedAt) {
      const elapsedSec = Math.floor((now - existing.lastRequestedAt) / 1000);
      if (elapsedSec < this.COOLDOWN_SECONDS) {
        const waitTime = this.COOLDOWN_SECONDS - elapsedSec;
        return {
          success: false,
          expiresInSeconds: 0,
          retryAfterSeconds: waitTime,
          message: `Please wait ${waitTime} seconds before requesting a new code.`
        };
      }
    }

    const code = crypto.randomInt(1000, 10000).toString();
    const codeHash = this.computeHmac(code, cleanId);
    this.memoryFallback.set(key, {
      codeHash,
      expiresAt: now + this.TTL_SECONDS * 1000,
      lastRequestedAt: now,
      attempts: 0,
      purpose,
      targetApp
    });

    return {
      success: true,
      code,
      expiresInSeconds: this.TTL_SECONDS,
      retryAfterSeconds: this.COOLDOWN_SECONDS,
      message: 'Verification code generated successfully.'
    };
  }

  /**
   * Atomically verifies and consumes the OTP using a Redis Lua script.
   * If correct, the code is immediately deleted so it CANNOT be re-used.
   * If invalid, the attempt counter is incremented up to 5 attempts.
   */
  public static async verifyAndConsumeOtp(
    identifier: string,
    candidateCode: string,
    purpose: string = 'login'
  ): Promise<OtpVerificationResult> {
    const cleanId = identifier.trim().toLowerCase();
    const key = this.getRedisKey(purpose, cleanId);
    const candidateHash = this.computeHmac(candidateCode.trim(), cleanId);

    const client = redisService.getClient();

    if (client && redisService.isRedisConnected()) {
      /**
       * Lua script:
       * KEYS[1]: OTP key
       * ARGV[1]: candidateHash
       * ARGV[2]: maxAttempts (5)
       *
       * Returns:
       *  1: Verified and consumed (DEL called)
       * -1: Key does not exist or expired
       * -2: Too many attempts (DEL called or blocked)
       *  0: Invalid code, remaining attempts returned in attempts field
       */
      const luaScript = `
        local key = KEYS[1]
        local candidateHash = ARGV[1]
        local maxAttempts = tonumber(ARGV[2])

        local exists = redis.call('EXISTS', key)
        if exists == 0 then
          return -1
        end

        local currentAttempts = tonumber(redis.call('HGET', key, 'attempts') or '0')
        if currentAttempts >= maxAttempts then
          redis.call('DEL', key)
          return -2
        end

        local storedHash = redis.call('HGET', key, 'codeHash')
        if storedHash == candidateHash then
          -- Code matched! Atomically delete key to enforce single-use
          redis.call('DEL', key)
          return 1
        else
          local newAttempts = redis.call('HINCRBY', key, 'attempts', 1)
          if newAttempts >= maxAttempts then
            redis.call('DEL', key)
            return -2
          end
          return newAttempts
        end
      `;

      try {
        const result = await client.eval(luaScript, 1, key, candidateHash, this.MAX_ATTEMPTS) as number;

        if (result === 1) {
          return {
            success: true,
            code: 'VERIFIED',
            message: 'Verification code confirmed.'
          };
        } else if (result === -1) {
          return {
            success: false,
            code: 'EXPIRED',
            message: 'Verification code has expired or does not exist. Please request a new code.'
          };
        } else if (result === -2) {
          return {
            success: false,
            code: 'TOO_MANY_ATTEMPTS',
            message: 'Maximum verification attempts exceeded. Code has been invalidated.'
          };
        } else {
          const remaining = Math.max(0, this.MAX_ATTEMPTS - result);
          return {
            success: false,
            code: 'INVALID_CODE',
            message: `Invalid verification code. ${remaining} attempt(s) remaining.`,
            remainingAttempts: remaining
          };
        }
      } catch (err: any) {
        console.warn('[RedisOtpService] Redis eval notice, engaging fallback:', err.message);
      }
    }

    // Memory fallback verification
    const record = this.memoryFallback.get(key);
    if (!record) {
      return {
        success: false,
        code: 'EXPIRED',
        message: 'Verification code has expired or does not exist.'
      };
    }

    if (Date.now() > record.expiresAt) {
      this.memoryFallback.delete(key);
      return {
        success: false,
        code: 'EXPIRED',
        message: 'Verification code has expired. Please request a new code.'
      };
    }

    if (record.attempts >= this.MAX_ATTEMPTS) {
      this.memoryFallback.delete(key);
      return {
        success: false,
        code: 'TOO_MANY_ATTEMPTS',
        message: 'Maximum verification attempts exceeded. Code has been invalidated.'
      };
    }

    if (record.codeHash === candidateHash) {
      // Consume atomically
      this.memoryFallback.delete(key);
      return {
        success: true,
        code: 'VERIFIED',
        message: 'Verification code confirmed.'
      };
    } else {
      record.attempts += 1;
      if (record.attempts >= this.MAX_ATTEMPTS) {
        this.memoryFallback.delete(key);
        return {
          success: false,
          code: 'TOO_MANY_ATTEMPTS',
          message: 'Maximum verification attempts exceeded. Code has been invalidated.'
        };
      }
      const remaining = this.MAX_ATTEMPTS - record.attempts;
      return {
        success: false,
        code: 'INVALID_CODE',
        message: `Invalid verification code. ${remaining} attempt(s) remaining.`,
        remainingAttempts: remaining
      };
    }
  }

  /**
   * Cleans up or explicitly invalidates an active OTP
   */
  public static async invalidateOtp(identifier: string, purpose: string = 'login'): Promise<void> {
    const key = this.getRedisKey(purpose, identifier);
    this.memoryFallback.delete(key);
    const client = redisService.getClient();
    if (client && redisService.isRedisConnected()) {
      await client.del(key).catch(() => {});
    }
  }
}

export default RedisOtpService;
