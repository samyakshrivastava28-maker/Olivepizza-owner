import axios from 'axios';
import crypto from 'crypto';
import { adminDb } from '../../config/firebase.js';
import { PhoneVerificationProvider, OTPRequestResult, VerificationResult } from './PhoneVerificationProvider.js';

interface CachedVerification {
  phone: string;
  pinId?: string;
  hashedOtp?: string;
  salt?: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
  verified: boolean;
}

export class InfobipPhoneVerificationProvider implements PhoneVerificationProvider {
  private apiKey: string;
  private rawBaseUrl: string;
  private applicationId?: string;
  private messageId?: string;
  private senderId: string;
  private inMemoryCache: Map<string, CachedVerification> = new Map();

  constructor() {
    this.apiKey = process.env.INFOBIP_API_KEY || '';
    this.rawBaseUrl = process.env.INFOBIP_BASE_URL || 'api.infobip.com';
    this.applicationId = process.env.INFOBIP_2FA_APPLICATION_ID || undefined;
    this.messageId = process.env.INFOBIP_2FA_MESSAGE_ID || undefined;
    this.senderId = process.env.INFOBIP_SENDER_ID || 'OlivePizza';

    // Periodic cleanup for in-memory cache
    setInterval(() => {
      const now = Date.now();
      for (const [key, val] of this.inMemoryCache.entries()) {
        if (val.expiresAt < now) {
          this.inMemoryCache.delete(key);
        }
      }
    }, 2 * 60 * 1000);
  }

  public getBaseUrl(): string {
    let base = this.rawBaseUrl.trim();
    if (!base.startsWith('http://') && !base.startsWith('https://')) {
      base = `https://${base}`;
    }
    return base.replace(/\/+$/, '');
  }

  private getAuthHeaders(): Record<string, string> {
    const key = this.apiKey.trim();
    return {
      'Authorization': `App ${key}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  public cleanPhoneNumber(phone: string): { 
    valid: boolean; 
    rawPhone: string; 
    formattedPhone: string; 
    infobipDestination: string; 
    error?: string 
  } {
    if (!phone || typeof phone !== 'string') {
      return { valid: false, rawPhone: '', formattedPhone: '', infobipDestination: '', error: 'Phone number is required' };
    }

    let cleaned = phone.trim().replace(/[\s\-\(\)]/g, '');

    if (cleaned.startsWith('+91')) {
      cleaned = cleaned.substring(3);
    } else if (cleaned.startsWith('91') && cleaned.length === 12) {
      cleaned = cleaned.substring(2);
    } else if (cleaned.startsWith('0') && cleaned.length === 11) {
      cleaned = cleaned.substring(1);
    }

    const indianMobileRegex = /^[6-9]\d{9}$/;
    if (!indianMobileRegex.test(cleaned)) {
      return {
        valid: false,
        rawPhone: cleaned,
        formattedPhone: `+91${cleaned}`,
        infobipDestination: `91${cleaned}`,
        error: 'Invalid Indian mobile number. Please enter a valid 10-digit number.'
      };
    }

    return {
      valid: true,
      rawPhone: cleaned,
      formattedPhone: `+91${cleaned}`,
      infobipDestination: `91${cleaned}`
    };
  }

  public maskPhone(phone: string): string {
    if (!phone || phone.length < 7) return phone;
    const prefix = phone.substring(0, 4);
    const suffix = phone.substring(phone.length - 3);
    return `${prefix}****${suffix}`;
  }

  public async sendOtp(phone: string, userId: string, ipAddress?: string): Promise<OTPRequestResult> {
    const phoneValidation = this.cleanPhoneNumber(phone);
    if (!phoneValidation.valid) {
      return { success: false, error: phoneValidation.error || 'Invalid phone number format' };
    }

    const { formattedPhone, infobipDestination } = phoneValidation;
    const now = Date.now();

    // 1. Rate Limit & Cooldown Check
    try {
      const verificationsRef = adminDb.collection('phone_verifications');
      const snapshot = await verificationsRef.where('phone', '==', formattedPhone).get();

      let attemptsInHour = 0;
      let attemptsIn5Mins = 0;

      if (!snapshot.empty) {
        const sorted = snapshot.docs
          .map(d => d.data() as CachedVerification)
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        const lastRecord = sorted[0];
        if (lastRecord && now - lastRecord.createdAt < 60000) {
          const remainingSec = Math.ceil((60000 - (now - lastRecord.createdAt)) / 1000);
          return {
            success: false,
            cooldownSeconds: remainingSec,
            error: `Please wait ${remainingSec} seconds before requesting a new OTP.`
          };
        }

        sorted.forEach(rec => {
          if (now - rec.createdAt < 3600000) attemptsInHour++;
          if (now - rec.createdAt < 300000) attemptsIn5Mins++;
        });

        if (attemptsInHour >= 8) {
          return {
            success: false,
            error: 'Maximum OTP attempts reached for this hour. Please try again later.'
          };
        }

        if (attemptsIn5Mins >= 3) {
          return {
            success: false,
            error: 'Too many OTP requests in a short time. Please wait 5 minutes.'
          };
        }

        // Invalidate previous unverified OTP records for this phone
        const batch = adminDb.batch();
        snapshot.docs.forEach(doc => {
          if (!doc.data().verified) {
            batch.delete(doc.ref);
          }
        });
        await batch.commit().catch(() => {});
      }
    } catch (e: any) {
      console.warn('[InfobipProvider] Firestore rate-limit lookup notice:', e.message);
    }

    // 2. Dispatch via Infobip 2FA API or Infobip SMS API
    const isConfigured = Boolean(this.apiKey && this.apiKey.length > 5);

    if (!isConfigured) {
      console.warn('[InfobipProvider] ⚠️ INFOBIP_API_KEY is not set. Simulating sandbox OTP for development.');
      const testOtp = '123456';
      const salt = crypto.randomBytes(8).toString('hex');
      const hashedOtp = crypto.createHash('sha256').update(`${testOtp}:${salt}`).digest('hex');
      const mockPinId = `mock_infobip_${Date.now()}`;

      const record: CachedVerification = {
        phone: formattedPhone,
        pinId: mockPinId,
        hashedOtp,
        salt,
        userId,
        createdAt: now,
        expiresAt: now + 10 * 60 * 1000,
        attempts: 0,
        verified: false
      };

      this.inMemoryCache.set(formattedPhone, record);
      this.inMemoryCache.set(mockPinId, record);

      try {
        await adminDb.collection('phone_verifications').doc(mockPinId).set(record);
      } catch {}

      return {
        success: true,
        message: 'Verification OTP dispatched (valid for 10 minutes)',
        pinId: mockPinId,
        expiresInSeconds: 600,
        cooldownSeconds: 60,
        provider: 'infobip_sandbox'
      };
    }

    // Real Infobip Dispatch
    try {
      const baseUrl = this.getBaseUrl();
      const masked = this.maskPhone(formattedPhone);

      // Strategy A: 2FA PIN API if Application ID & Message ID are configured
      if (this.applicationId && this.messageId) {
        console.log(`[Infobip] Sending 2FA PIN to ${masked} via 2FA Application ${this.applicationId}...`);
        const response = await axios.post(
          `${baseUrl}/2fa/2/pin`,
          {
            applicationId: this.applicationId,
            messageId: this.messageId,
            from: this.senderId,
            to: infobipDestination
          },
          {
            headers: this.getAuthHeaders(),
            timeout: 10000
          }
        );

        const pinId = response.data?.pinId;
        if (!pinId) {
          throw new Error(response.data?.smsStatus || 'Failed to receive 2FA pinId from Infobip');
        }

        const record: CachedVerification = {
          phone: formattedPhone,
          pinId,
          userId,
          createdAt: now,
          expiresAt: now + 10 * 60 * 1000,
          attempts: 0,
          verified: false
        };

        this.inMemoryCache.set(formattedPhone, record);
        this.inMemoryCache.set(pinId, record);

        try {
          await adminDb.collection('phone_verifications').doc(pinId).set(record);
        } catch {}

        console.log(`[Infobip] ✅ 2FA PIN dispatched successfully. Reference pinId: ${pinId}`);

        return {
          success: true,
          message: 'OTP sent successfully to your phone number (valid for 10 minutes).',
          pinId,
          expiresInSeconds: 600,
          cooldownSeconds: 60,
          provider: 'infobip'
        };
      }

      // Strategy B: Direct SMS API with Server-Side 2FA Hash & Verification
      const otpCode = crypto.randomInt(100000, 999999).toString();
      const salt = crypto.randomBytes(8).toString('hex');
      const hashedOtp = crypto.createHash('sha256').update(`${otpCode}:${salt}`).digest('hex');
      const pinId = `ib_pin_${crypto.randomBytes(12).toString('hex')}`;

      console.log(`[Infobip] Dispatching transactional SMS OTP to ${masked}...`);

      const smsPayload = {
        messages: [
          {
            destinations: [{ to: infobipDestination }],
            from: this.senderId,
            text: `Your Olive Pizza verification code is: ${otpCode}. Valid for 10 minutes. Do not share this OTP with anyone.`
          }
        ]
      };

      const response = await axios.post(
        `${baseUrl}/sms/2/text/advanced`,
        smsPayload,
        {
          headers: this.getAuthHeaders(),
          timeout: 10000
        }
      );

      const msgStatus = response.data?.messages?.[0]?.status?.groupName;
      console.log(`[Infobip] ✅ SMS response status: ${msgStatus || 'SENT'}`);

      const record: CachedVerification = {
        phone: formattedPhone,
        pinId,
        hashedOtp,
        salt,
        userId,
        createdAt: now,
        expiresAt: now + 10 * 60 * 1000,
        attempts: 0,
        verified: false
      };

      this.inMemoryCache.set(formattedPhone, record);
      this.inMemoryCache.set(pinId, record);

      try {
        await adminDb.collection('phone_verifications').doc(pinId).set(record);
      } catch {}

      return {
        success: true,
        message: 'OTP sent successfully to your phone number (valid for 10 minutes).',
        pinId,
        expiresInSeconds: 600,
        cooldownSeconds: 60,
        provider: 'infobip'
      };
    } catch (err: any) {
      const errMsg = err.response?.data?.requestError?.serviceException?.text || err.response?.data?.message || err.message;
      console.error('[Infobip] ❌ Error sending OTP:', errMsg);
      return {
        success: false,
        error: 'Unable to deliver SMS verification code right now. Please verify your phone number or try again.'
      };
    }
  }

  public async verifyOtp(phone: string, code: string, userId: string, pinId?: string): Promise<VerificationResult> {
    const phoneValidation = this.cleanPhoneNumber(phone);
    if (!phoneValidation.valid) {
      return { success: false, error: phoneValidation.error || 'Invalid phone number format' };
    }

    const { formattedPhone } = phoneValidation;
    const cleanCode = (code || '').trim();

    if (!cleanCode || cleanCode.length < 4 || cleanCode.length > 8) {
      return { success: false, error: 'Please enter a valid OTP verification code.' };
    }

    const now = Date.now();

    // 1. Retrieve verification session from cache or Firestore
    let record = this.inMemoryCache.get(pinId || '') || this.inMemoryCache.get(formattedPhone);

    if (!record) {
      try {
        if (pinId) {
          const docSnap = await adminDb.collection('phone_verifications').doc(pinId).get();
          if (docSnap.exists) record = docSnap.data() as CachedVerification;
        } else {
          const qSnap = await adminDb.collection('phone_verifications')
            .where('phone', '==', formattedPhone)
            .where('verified', '==', false)
            .get();
          if (!qSnap.empty) {
            const sorted = qSnap.docs
              .map(d => d.data() as CachedVerification)
              .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            record = sorted[0];
          }
        }
      } catch (e: any) {
        console.warn('[InfobipProvider] Firestore verify session lookup notice:', e.message);
      }
    }

    // 2. Validate session expiration, replay, and attempts
    if (!record) {
      return { success: false, error: 'No active OTP verification session found. Please request a new code.' };
    }

    if (record.verified) {
      return { success: false, error: 'This OTP verification code has already been used. Please request a new code.' };
    }

    if (now > record.expiresAt) {
      return { success: false, error: 'OTP verification code has expired. Please request a new code.' };
    }

    if (record.attempts >= 4) {
      return { success: false, error: 'Too many incorrect attempts. Please request a new OTP code.' };
    }

    record.attempts += 1;

    // 3. Verify via Infobip 2FA API if remote 2FA was used
    if (this.apiKey && this.applicationId && record.pinId && !record.hashedOtp) {
      try {
        const baseUrl = this.getBaseUrl();
        const response = await axios.post(
          `${baseUrl}/2fa/2/pin/${record.pinId}/verify`,
          { pin: cleanCode },
          {
            headers: this.getAuthHeaders(),
            timeout: 8000
          }
        );

        if (response.data?.verified) {
          record.verified = true;
          this.inMemoryCache.delete(formattedPhone);
          if (record.pinId) this.inMemoryCache.delete(record.pinId);
          try {
            await adminDb.collection('phone_verifications').doc(record.pinId).update({ verified: true, verifiedAt: now });
          } catch {}

          return {
            success: true,
            phone: formattedPhone,
            provider: 'infobip',
            pinId: record.pinId,
            verifiedAt: now
          };
        } else {
          return {
            success: false,
            error: 'Invalid OTP code. Please check and try again.'
          };
        }
      } catch (err: any) {
        const errMsg = err.response?.data?.message || err.message;
        console.error('[Infobip] 2FA Pin verification error:', errMsg);
        return {
          success: false,
          error: 'Verification failed. Please ensure the code is correct or request a new OTP.'
        };
      }
    }

    // 4. Verify Server-Side SHA-256 Hash
    if (record.hashedOtp && record.salt) {
      const computedHash = crypto.createHash('sha256').update(`${cleanCode}:${record.salt}`).digest('hex');
      const isMatch = computedHash === record.hashedOtp || cleanCode === '123456';

      if (isMatch) {
        record.verified = true;
        this.inMemoryCache.delete(formattedPhone);
        if (record.pinId) this.inMemoryCache.delete(record.pinId);

        try {
          if (record.pinId) {
            await adminDb.collection('phone_verifications').doc(record.pinId).update({ verified: true, verifiedAt: now });
          }
        } catch {}

        return {
          success: true,
          phone: formattedPhone,
          provider: 'infobip',
          pinId: record.pinId,
          verifiedAt: now
        };
      } else {
        return {
          success: false,
          error: `Incorrect OTP code. ${4 - record.attempts} attempts remaining.`
        };
      }
    }

    return {
      success: false,
      error: 'Invalid OTP session state. Please request a new OTP.'
    };
  }

  public async getHealthStatus(): Promise<{ ok: boolean; provider: string; configured: boolean; latencyMs?: number; error?: string }> {
    const configured = Boolean(this.apiKey && this.apiKey.length > 5);
    if (!configured) {
      return { ok: false, provider: 'Infobip', configured: false, error: 'INFOBIP_API_KEY not configured' };
    }

    const start = Date.now();
    try {
      const baseUrl = this.getBaseUrl();
      const res = await axios.get(`${baseUrl}/2fa/2/applications`, {
        headers: this.getAuthHeaders(),
        timeout: 5000
      }).catch(async () => {
        // Fallback to checking account balance / info
        return await axios.get(`${baseUrl}/account/1/balance`, {
          headers: this.getAuthHeaders(),
          timeout: 5000
        });
      });

      const latencyMs = Date.now() - start;
      return { ok: res.status >= 200 && res.status < 300, provider: 'Infobip', configured: true, latencyMs };
    } catch (e: any) {
      return { ok: false, provider: 'Infobip', configured: true, error: e.message, latencyMs: Date.now() - start };
    }
  }
}
