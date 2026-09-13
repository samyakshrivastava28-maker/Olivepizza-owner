import { adminDb } from '../../config/firebase.js';
import { AuthAuditService } from './AuthAuditService.js';

export interface RateLimitStatus {
  allowed: boolean;
  attempts: number;
  remainingAttempts: number;
  retryAfterSeconds: number;
}

export class LoginRateLimiterService {
  private static readonly COLLECTION = 'login_rate_limits';
  private static readonly MAX_ATTEMPTS = 2; // Max 2 attempts allowed; 3rd is rejected
  private static readonly WINDOW_MS = 15 * 60 * 1000; // 15 minutes

  private static getDocId(identifier: string, ipAddress: string): string {
    const cleanId = (identifier || 'unknown').toLowerCase().trim().replace(/[^a-zA-Z0-9_@.-]/g, '_');
    const cleanIp = (ipAddress || 'unknown').replace(/[^a-zA-Z0-9_]/g, '_');
    return `${cleanId}__${cleanIp}`;
  }

  /**
   * Check whether a login attempt is allowed under the 2-attempt / 15-minute policy.
   */
  public static async checkLimit(identifier: string, ipAddress: string): Promise<RateLimitStatus> {
    if (!adminDb) {
      return { allowed: true, attempts: 0, remainingAttempts: this.MAX_ATTEMPTS, retryAfterSeconds: 0 };
    }

    const docId = this.getDocId(identifier, ipAddress);
    const ref = adminDb.collection(this.COLLECTION).doc(docId);
    const snap = await ref.get();
    const now = Date.now();

    if (!snap.exists) {
      return { allowed: true, attempts: 0, remainingAttempts: this.MAX_ATTEMPTS, retryAfterSeconds: 0 };
    }

    const data = snap.data() || {};
    const firstAttemptAt = data.firstAttemptAt || 0;
    const attempts = data.attempts || 0;

    // Check if the 15-minute window has expired
    if (now - firstAttemptAt > this.WINDOW_MS) {
      return { allowed: true, attempts: 0, remainingAttempts: this.MAX_ATTEMPTS, retryAfterSeconds: 0 };
    }

    // If attempts have already exceeded MAX_ATTEMPTS (2), block the next attempt
    if (attempts > this.MAX_ATTEMPTS) {
      const retryAfterSeconds = Math.max(1, Math.ceil((firstAttemptAt + this.WINDOW_MS - now) / 1000));
      
      await AuthAuditService.logEvent({
        eventType: 'LOGIN_RATE_LIMITED',
        identifier,
        ipAddress,
        status: 'BLOCKED',
        metadata: { attempts, retryAfterSeconds },
      });

      return {
        allowed: false,
        attempts,
        remainingAttempts: 0,
        retryAfterSeconds,
      };
    }

    return {
      allowed: true,
      attempts,
      remainingAttempts: this.MAX_ATTEMPTS - attempts,
      retryAfterSeconds: 0,
    };
  }

  /**
   * Record a failed or in-flight login attempt against the 15-minute rate limit window.
   */
  public static async recordAttempt(identifier: string, ipAddress: string): Promise<number> {
    if (!adminDb) return 1;

    const docId = this.getDocId(identifier, ipAddress);
    const ref = adminDb.collection(this.COLLECTION).doc(docId);
    const snap = await ref.get();
    const now = Date.now();

    if (!snap.exists) {
      await ref.set({
        identifier: identifier.toLowerCase().trim(),
        ipAddress,
        attempts: 1,
        firstAttemptAt: now,
        lastAttemptAt: now,
      });
      return 1;
    }

    const data = snap.data() || {};
    const firstAttemptAt = data.firstAttemptAt || 0;
    let attempts = data.attempts || 0;

    if (now - firstAttemptAt > this.WINDOW_MS) {
      // Window expired, reset to 1
      attempts = 1;
      await ref.set({
        identifier: identifier.toLowerCase().trim(),
        ipAddress,
        attempts: 1,
        firstAttemptAt: now,
        lastAttemptAt: now,
      });
      return 1;
    }

    attempts += 1;
    await ref.update({
      attempts,
      lastAttemptAt: now,
    });

    return attempts;
  }

  /**
   * Reset rate limit on successful authentication.
   */
  public static async recordSuccess(identifier: string, ipAddress: string): Promise<void> {
    if (!adminDb) return;
    try {
      const docId = this.getDocId(identifier, ipAddress);
      await adminDb.collection(this.COLLECTION).doc(docId).delete();
    } catch (err) {
      console.warn('[LoginRateLimiterService] Warning: Failed to clear rate limit on success:', err);
    }
  }
}
