/**
 * EmailVerificationService.ts — Redis-Backed Production Email Verification Engine
 * 
 * Powered by RedisOtpService for HMAC-SHA256 keyed storage, atomic single-use Lua script
 * consumption, 5-minute strict TTL, and 60-second cooldown, combined with direct pooled SMTP delivery.
 */

import { adminDb, adminAuth } from '../../config/firebase.js';
import { queueEmail, sendEmailDirect } from '../email.service.js';
import { AuthAuditService } from './AuthAuditService.js';
import { RedisOtpService } from './RedisOtpService.js';

export interface VerificationSendResult {
  success: boolean;
  message: string;
  expiresInSeconds?: number;
  retryAfterSeconds?: number;
  demoCode?: string;
  warning?: string;
}

export interface VerificationCheckResult {
  success: boolean;
  message: string;
  remainingAttempts?: number;
}

export class EmailVerificationService {
  /**
   * Alias for sendVerificationCode
   */
  public static async sendCode(email: string, purpose: string = 'email_login', ipAddress: string = '127.0.0.1'): Promise<VerificationSendResult> {
    return this.sendVerificationCode(email, ipAddress, purpose);
  }

  /**
   * Request a 4-digit verification code sent to the specified email address.
   */
  public static async sendVerificationCode(
    email: string,
    ipAddress: string = '127.0.0.1',
    purpose: string = 'email_login'
  ): Promise<VerificationSendResult> {
    if (!email || !email.includes('@')) {
      return { success: false, message: 'A valid email address is required.' };
    }

    const cleanEmail = email.toLowerCase().trim();

    // Generate code via RedisOtpService with HMAC storage, 60s cooldown, and 5-min TTL
    const otpResult = await RedisOtpService.generateOtp(cleanEmail, purpose);

    if (!otpResult.success || !otpResult.code) {
      return {
        success: false,
        message: otpResult.message,
        retryAfterSeconds: otpResult.retryAfterSeconds,
        expiresInSeconds: 0
      };
    }

    const code = otpResult.code;

    // Send styled transactional email using existing pooled SMTP transport
    const emailHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #f0f0f0; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 32px 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">OLIVE PIZZA</h1>
          <p style="color: #d1fae5; margin: 6px 0 0 0; font-size: 14px; font-weight: 500;">Security Verification Code</p>
        </div>
        <div style="padding: 32px 28px;">
          <p style="color: #374151; font-size: 15px; line-height: 22px; margin: 0 0 20px 0;">
            Hello,
          </p>
          <p style="color: #374151; font-size: 15px; line-height: 22px; margin: 0 0 24px 0;">
            Use the following 4-digit security code to complete your verification with Olive Pizza. This code is confidential and valid for <strong>5 minutes</strong>.
          </p>
          <div style="background: #f3f4f6; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <span style="font-family: monospace; font-size: 38px; font-weight: 900; letter-spacing: 12px; color: #059669; display: inline-block; margin-left: 12px;">
              ${code}
            </span>
          </div>
          <div style="border-left: 4px solid #f59e0b; background: #fffbeb; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
            <p style="color: #92400e; font-size: 13px; margin: 0; line-height: 18px;">
              <strong>Security Notice:</strong> Never share this code with anyone. Olive Pizza staff will never ask you for your verification code.
            </p>
          </div>
          <p style="color: #9ca3af; font-size: 12px; margin: 0; line-height: 18px; text-align: center;">
            If you did not request this verification, you can safely ignore this email.
          </p>
        </div>
        <div style="background: #f9fafb; padding: 16px 24px; text-align: center; border-top: 1px solid #f3f4f6;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">
            © ${new Date().getFullYear()} Olive Pizza Ecosystem. All rights reserved.
          </p>
        </div>
      </div>
    `;

    // Dispatch email asynchronously using high-speed pooled SMTP queue
    queueEmail(cleanEmail, 'Your Olive Pizza 4-Digit Verification Code', emailHtml, 'auth')
      .then((queueId) => {
        console.log(`[EmailVerificationService] ✅ Verification email queued for ${cleanEmail} (ID: ${queueId})`);
      })
      .catch((err: any) => {
        console.warn(`[EmailVerificationService] Queue error, using direct pooled SMTP send:`, err?.message);
        sendEmailDirect(cleanEmail, 'Your Olive Pizza 4-Digit Verification Code', emailHtml)
          .then(() => console.log(`[EmailVerificationService] ✅ Verification email delivered directly via SMTP to ${cleanEmail}`))
          .catch((directErr: any) => console.error('[EmailVerificationService] ❌ Failed to dispatch email via SMTP:', directErr?.message || directErr));
      });

    // Record audit event asynchronously
    AuthAuditService.logEvent({
      eventType: 'EMAIL_CODE_REQUESTED',
      identifier: cleanEmail,
      ipAddress,
      status: 'SUCCESS',
      metadata: { expiresInSeconds: otpResult.expiresInSeconds, purpose },
    }).catch(() => {});

    const isDevelopment = process.env.NODE_ENV !== 'production' || process.env.PHONE_AUTH_MODE === 'development';
    return {
      success: true,
      message: 'Verification code sent successfully. Valid for 5 minutes.',
      expiresInSeconds: otpResult.expiresInSeconds,
      retryAfterSeconds: otpResult.retryAfterSeconds,
      demoCode: isDevelopment ? code : undefined,
    };
  }

  /**
   * Verify the 4-digit code atomically via Redis Lua script.
   */
  public static async verifyCode(
    email: string,
    code: string,
    ipAddress: string = '127.0.0.1',
    purpose: string = 'email_login'
  ): Promise<VerificationCheckResult> {
    if (!email || !code) {
      return { success: false, message: 'Email and 4-digit code are required.' };
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanCode = code.toString().trim();

    if (!/^\d{4}$/.test(cleanCode)) {
      return { success: false, message: 'Verification code must be exactly 4 digits.' };
    }

    // Atomically verify and consume via Redis Lua script
    const verifyResult = await RedisOtpService.verifyAndConsumeOtp(cleanEmail, cleanCode, purpose);

    if (!verifyResult.success) {
      await AuthAuditService.logEvent({
        eventType: 'EMAIL_CODE_FAILED',
        identifier: cleanEmail,
        ipAddress,
        status: 'FAILED',
        metadata: { code: verifyResult.code, remainingAttempts: verifyResult.remainingAttempts },
      }).catch(() => {});

      return {
        success: false,
        message: verifyResult.message,
        remainingAttempts: verifyResult.remainingAttempts
      };
    }

    // Authoritatively mark user record as email verified in Firebase Auth and Firestore
    try {
      if (adminAuth) {
        const authUser = await adminAuth.getUserByEmail(cleanEmail).catch(() => null);
        if (authUser) {
          await adminAuth.updateUser(authUser.uid, { emailVerified: true }).catch(() => {});
        }
      }
      if (adminDb) {
        const userQuery = await adminDb.collection('users').where('email', '==', cleanEmail).limit(1).get().catch(() => null);
        if (userQuery && !userQuery.empty) {
          await userQuery.docs[0].ref.update({
            emailVerified: true,
            emailVerifiedAt: new Date().toISOString(),
          }).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('[EmailVerificationService] Notice: could not update auth/users collection flag:', err);
    }

    await AuthAuditService.logEvent({
      eventType: 'EMAIL_CODE_VERIFIED',
      identifier: cleanEmail,
      ipAddress,
      status: 'SUCCESS',
    }).catch(() => {});

    return { success: true, message: 'Email verified successfully.' };
  }
}
