/**
 * FirebasePhoneVerificationProvider.ts — Unified Phone Auth Provider
 * 
 * Supports both:
 * 1. Firebase Phone Authentication (ID Token verification)
 * 2. Backend Redis-Managed SMS OTP with Fast2SMS transport, atomic Lua consumption, and HMAC hashing
 */

import { PhoneVerificationProvider, OTPRequestResult, VerificationResult } from './PhoneVerificationProvider.js';
import { adminAuth, adminDb } from '../../config/firebase.js';
import { DevOtpBypassService } from './DevOtpBypassService.js';
import { normalizePhone } from '../../utils/phoneNormalization.js';
import { RedisOtpService } from '../auth/RedisOtpService.js';
import { Fast2SmsService } from '../sms/Fast2SmsService.js';

export class FirebasePhoneVerificationProvider implements PhoneVerificationProvider {
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production' || process.env.PHONE_AUTH_MODE === 'development';
  }

  public normalizePhone(phone: string): { valid: boolean; formattedPhone: string; error?: string } {
    const norm = normalizePhone(phone);
    if (!norm.isValid) {
      return { valid: false, formattedPhone: '', error: 'Invalid phone number format. Please provide a 10-digit mobile number.' };
    }
    return { valid: true, formattedPhone: norm.e164 };
  }

  /**
   * Health check for Firebase Authentication service
   */
  public async getHealthStatus(): Promise<{ ok: boolean; provider: string; configured: boolean; latencyMs?: number; error?: string }> {
    const start = Date.now();
    try {
      await adminAuth.listUsers(1);
      return {
        ok: true,
        provider: 'firebase_auth',
        configured: true,
        latencyMs: Date.now() - start
      };
    } catch (err: any) {
      return {
        ok: false,
        provider: 'firebase_auth',
        configured: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || process.env.FIREBASE_PROJECT_ID),
        latencyMs: Date.now() - start,
        error: err.message
      };
    }
  }

  /**
   * Generates a Redis-backed OTP and dispatches it via Fast2SMS / SMS Gateway
   */
  public async sendOtp(phone: string, _userId: string, _ipAddress?: string): Promise<OTPRequestResult> {
    const norm = this.normalizePhone(phone);
    if (!norm.valid) {
      return { success: false, error: norm.error };
    }

    // Generate secure OTP via RedisOtpService with HMAC storage, cooldown and 5m TTL
    const otpResult = await RedisOtpService.generateOtp(norm.formattedPhone, 'phone_login');

    if (!otpResult.success || !otpResult.code) {
      return {
        success: false,
        error: otpResult.message,
        cooldownSeconds: otpResult.retryAfterSeconds,
        expiresInSeconds: 0
      };
    }

    // Dispatch SMS via Fast2SMS gateway
    const smsResult = await Fast2SmsService.sendOtp(norm.formattedPhone, otpResult.code);

    if (!smsResult.success) {
      // In dev mode or when Fast2SMS is not configured, still return clear status
      return {
        success: false,
        error: smsResult.message || 'Failed to dispatch SMS OTP.',
        provider: 'fast2sms'
      };
    }

    return {
      success: true,
      message: 'SMS verification code sent successfully. Valid for 5 minutes.',
      provider: 'fast2sms',
      expiresInSeconds: otpResult.expiresInSeconds,
      cooldownSeconds: otpResult.retryAfterSeconds,
      pinId: smsResult.requestId
    };
  }

  /**
   * Verifies Phone Authentication:
   * 1. Firebase ID Tokens directly (JWT).
   * 2. Redis-backed SMS OTP codes (atomic Lua consumption & HMAC).
   * 3. Dev bypass in development environments.
   */
  public async verifyOtp(phone: string, code: string, userId: string, pinId?: string): Promise<VerificationResult> {
    if (!code || typeof code !== 'string' || !code.trim()) {
      return { success: false, error: 'OTP code cannot be empty.' };
    }

    const norm = this.normalizePhone(phone);
    if (!norm.valid) {
      return { success: false, error: norm.error };
    }

    // 1. Firebase ID Token (JWT candidate)
    const tokenCandidate = (code && code.split('.').length === 3) ? code : (pinId && pinId.split('.').length === 3 ? pinId : null);
    if (tokenCandidate) {
      try {
        const decoded = await adminAuth.verifyIdToken(tokenCandidate);
        const verifiedPhone = decoded.phone_number ? this.normalizePhone(decoded.phone_number).formattedPhone : norm.formattedPhone;

        if (decoded.phone_number && verifiedPhone !== norm.formattedPhone) {
          return {
            success: false,
            error: `Verified token phone (${verifiedPhone}) does not match submitted phone (${norm.formattedPhone})`
          };
        }

        const now = Date.now();
        if (userId && !userId.startsWith('anon_')) {
          await this.syncVerifiedPhone(userId, verifiedPhone);
        }

        return {
          success: true,
          phone: verifiedPhone,
          provider: 'firebase',
          verifiedAt: now
        };
      } catch (err: any) {
        console.error('[FirebasePhoneProvider] ID Token verification failed:', err.message);
        return { success: false, error: 'Invalid or expired Firebase authentication token.' };
      }
    }

    // 2. Redis-backed atomic OTP verification
    const redisVerify = await RedisOtpService.verifyAndConsumeOtp(norm.formattedPhone, code, 'phone_login');
    if (redisVerify.success) {
      const now = Date.now();
      if (userId && !userId.startsWith('anon_')) {
        await this.syncVerifiedPhone(userId, norm.formattedPhone);
      }
      return {
        success: true,
        phone: norm.formattedPhone,
        provider: 'backend_redis',
        verifiedAt: now
      };
    }

    // 3. Strict Development-Only OTP Bypass
    if (DevOtpBypassService.isDevOtpBypassActive()) {
      const now = Date.now();
      if (userId && !userId.startsWith('anon_')) {
        await this.syncVerifiedPhone(userId, norm.formattedPhone);
      }
      return {
        success: true,
        phone: norm.formattedPhone,
        provider: 'dev_bypass',
        verifiedAt: now
      };
    }

    // 4. Test / Sandbox phone numbers in development mode
    if (this.isDevelopment) {
      const isTestPhone = norm.formattedPhone === '+919999999999' || norm.formattedPhone === '+918305500767' || norm.formattedPhone.endsWith('123456');
      if (isTestPhone && (code === '123456' || code === '000000')) {
        const now = Date.now();
        if (userId && !userId.startsWith('anon_')) {
          await this.syncVerifiedPhone(userId, norm.formattedPhone);
        }
        return {
          success: true,
          phone: norm.formattedPhone,
          provider: 'firebase_sandbox',
          verifiedAt: now
        };
      }
    }

    // Return the specific Redis failure (e.g. EXPIRED, TOO_MANY_ATTEMPTS, or INVALID_CODE with remaining attempts)
    return {
      success: false,
      error: redisVerify.message || 'Invalid or expired verification code.'
    };
  }

  /**
   * Syncs verified phone identity to Firestore collections
   */
  public async syncVerifiedPhone(uid: string, phone: string): Promise<void> {
    try {
      const now = Date.now();
      await adminDb.collection('users').doc(uid).set({
        phone,
        phoneNumber: phone,
        phoneVerified: true,
        verificationMethod: 'sms_otp',
        verifiedAt: now,
        phoneSetupCompleted: true
      }, { merge: true });

      await adminDb.collection('customer_identities').doc(phone).set({
        primaryUid: uid,
        verifiedAt: now
      }, { merge: true });
    } catch (e: any) {
      console.warn('[FirebasePhoneProvider] Firestore sync notice:', e.message);
    }
  }
}
