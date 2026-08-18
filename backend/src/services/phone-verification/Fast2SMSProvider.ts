import axios from 'axios';
import crypto from 'crypto';
import { adminDb } from '../../config/firebase.js';
import bcrypt from 'bcrypt';
import { PhoneVerificationProvider, OTPRequestResult, VerificationResult } from './PhoneVerificationProvider.js';
import { aiOperationsStore } from '../devOps/AIOperationsService.js';

export class Fast2SMSProvider implements PhoneVerificationProvider {
  private apiKey: string;
  private mode: 'development' | 'production';
  
  constructor() {
    this.apiKey = process.env.FAST2SMS_API_KEY || '';
    this.mode = (process.env.PHONE_AUTH_MODE as 'development' | 'production') || 'development';
  }

  /**
   * Validates and cleans Indian phone numbers (+91-XXXXXXXXXX -> 10-digit number)
   */
  public cleanPhoneNumber(phone: string): { valid: boolean; rawPhone: string; formattedPhone: string; error?: string } {
    if (!phone || typeof phone !== 'string') {
      return { valid: false, rawPhone: '', formattedPhone: '', error: 'Phone number is required' };
    }
    
    // Remove all non-digits except leading plus
    let cleaned = phone.trim().replace(/[\s\-\(\)]/g, '');
    
    if (cleaned.startsWith('+91')) {
      cleaned = cleaned.substring(3);
    } else if (cleaned.startsWith('91') && cleaned.length === 12) {
      cleaned = cleaned.substring(2);
    } else if (cleaned.startsWith('0') && cleaned.length === 11) {
      cleaned = cleaned.substring(1);
    }

    // Must be exactly 10 digits starting with 6, 7, 8, or 9
    const indianMobileRegex = /^[6-9]\d{9}$/;
    if (!indianMobileRegex.test(cleaned)) {
      return { 
        valid: false, 
        rawPhone: cleaned, 
        formattedPhone: `+91${cleaned}`, 
        error: 'Invalid Indian mobile number. Please enter a valid 10-digit number.' 
      };
    }

    return {
      valid: true,
      rawPhone: cleaned,
      formattedPhone: `+91${cleaned}`
    };
  }

  public async sendOtp(phone: string, userId: string): Promise<OTPRequestResult> {
    const startTime = Date.now();
    try {
      const phoneValidation = this.cleanPhoneNumber(phone);
      if (!phoneValidation.valid) {
        return { success: false, error: phoneValidation.error || 'Invalid phone number format' };
      }

      const rawPhone = phoneValidation.rawPhone;
      const formattedPhone = phoneValidation.formattedPhone;

      // Rate limit check
      const otpsRef = adminDb.collection('phone_verifications').where('phone', '==', formattedPhone);
      const snapshot = await otpsRef.get();
      
      const now = Date.now();
      let attemptsInHour = 0;
      let attemptsIn5Mins = 0;
      
      if (!snapshot.empty) {
        const sortedDocs = snapshot.docs.sort((a, b) => (b.data().createdAt || 0) - (a.data().createdAt || 0));
        const lastOtp = sortedDocs[0].data();
        
        // 60-second cooldown
        if (now - lastOtp.createdAt < 60000) {
          const remainingSec = Math.ceil((60000 - (now - lastOtp.createdAt)) / 1000);
          return { success: false, error: `Please wait ${remainingSec} seconds before requesting another OTP.` };
        }
        
        // Rate Limits: Max 10 per hour, Max 3 per 5 mins
        sortedDocs.forEach(doc => {
          const createdAt = doc.data().createdAt || 0;
          if (now - createdAt < 3600000) attemptsInHour++;
          if (now - createdAt < 300000) attemptsIn5Mins++;
        });
        
        if (attemptsInHour >= 10) {
          return { success: false, error: 'Maximum OTP attempts reached for this hour. Please try again later.' };
        }
        if (attemptsIn5Mins >= 3) {
          return { success: false, error: 'Too many OTP requests in a short time. Please wait 5 minutes.' };
        }
        
        // Invalidate old OTPs
        const batch = adminDb.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }

      // Generate secure 6-digit OTP
      const otpCode = crypto.getRandomValues(new Uint32Array(1))[0].toString().padStart(6, '0').substring(0, 6);
      let sentViaGateway = false;
      let gatewayRequestId: string | undefined = undefined;
      let gatewayErrorMsg: string | undefined = undefined;


      if (this.apiKey && this.apiKey.trim().length > 5) {
        try {
          console.log(`[Fast2SMS] Dispatching real SMS to +91 ${rawPhone}...`);
          const response = await axios.post('https://www.fast2sms.com/dev/bulkV2', {
            route: 'otp',
            variables_values: otpCode,
            numbers: rawPhone,
            flash: '0'
          }, {
            headers: {
              'authorization': this.apiKey.trim(),
              'Content-Type': 'application/json'
            },
            timeout: 10000
          });

          if (response.data && response.data.return === true) {
            sentViaGateway = true;
            gatewayRequestId = response.data.request_id || (Array.isArray(response.data.message) ? response.data.message[0] : String(response.data.message));
            console.log(`[Fast2SMS] ✅ OTP successfully dispatched via Fast2SMS gateway. RequestID: ${gatewayRequestId}`);
            
            // Record to devops store
            aiOperationsStore.pushSmsLog({
              timestamp: new Date().toISOString(),
              phone: formattedPhone,
              provider: 'Fast2SMS (Production)',
              status: 'DELIVERED_TO_GATEWAY',
              requestId: gatewayRequestId || 'OK',
              latencyMs: Date.now() - startTime,
              success: true
            });
          } else {
            gatewayErrorMsg = Array.isArray(response.data?.message) ? response.data.message.join(', ') : response.data?.message || 'Gateway rejected SMS request';
            console.error('[Fast2SMS] ❌ Fast2SMS gateway returned error:', response.data);
            
            aiOperationsStore.pushSmsLog({
              timestamp: new Date().toISOString(),
              phone: formattedPhone,
              provider: 'Fast2SMS (Production)',
              status: 'GATEWAY_ERROR',
              error: gatewayErrorMsg,
              latencyMs: Date.now() - startTime,
              success: false
            });

            return {
              success: false,
              error: `Fast2SMS Gateway Error: ${gatewayErrorMsg}`
            };
          }
        } catch (apiErr: any) {
          const errMsg = apiErr.response?.data?.message || apiErr.message;
          console.error('[Fast2SMS] ❌ Gateway API connection failure:', errMsg);
          
          aiOperationsStore.pushSmsLog({
            timestamp: new Date().toISOString(),
            phone: formattedPhone,
            provider: 'Fast2SMS (Production)',
            status: 'NETWORK_ERROR',
            error: errMsg,
            latencyMs: Date.now() - startTime,
            success: false
          });

          return {
            success: false,
            error: `Failed to connect to Fast2SMS server: ${errMsg}`
          };
        }
      } else {
        if (this.mode === 'production') {
          console.error('[Fast2SMS] ❌ FAST2SMS_API_KEY is missing but PRODUCTION mode is active.');
          return { success: false, error: 'SMS Gateway is not configured correctly for production.' };
        }
        console.warn('[Fast2SMS] ⚠️ FAST2SMS_API_KEY is not configured. Running in Demo Mode.');
      }

      // Hash the OTP with bcrypt before storing
      const saltRounds = 10;
      const hashedOtp = await bcrypt.hash(otpCode, saltRounds);

      const newOtpRef = adminDb.collection('phone_verifications').doc();
      await newOtpRef.set({
        phone: formattedPhone,
        rawPhone,
        userId: userId || null,
        hashedOtp,
        createdAt: now,
        expiresAt: now + 4 * 60 * 1000, // Exactly 4 minutes expiry
        attempts: 0,
        type: 'fast2sms',
        gatewayRequestId: gatewayRequestId || null,
        isDemo: !sentViaGateway
      });

      return { 
        success: true, 
        message: sentViaGateway ? `OTP sent successfully via SMS to ${formattedPhone}.` : 'OTP sent! (Demo Mode: Enter 123456)' 
      };

    } catch (error: any) {
      console.error('[Fast2SMS] Exception:', error.message);
      return { success: false, error: error.message || 'An unexpected error occurred while sending OTP.' };
    }
  }

  public async verifyOtp(phone: string, code: string, userId: string): Promise<VerificationResult> {
    try {
      const phoneValidation = this.cleanPhoneNumber(phone);
      const formattedPhone = phoneValidation.valid ? phoneValidation.formattedPhone : phone;

      // Check if API key is active
      const hasActiveApiKey = this.apiKey && this.apiKey.trim().length > 5;

      // Demo OTP bypass ONLY allowed if mode is development
      if (this.mode === 'development' && code === '123456') {
        return {
          success: true,
          phone: formattedPhone,
          provider: 'fast2sms (demo)'
        };
      }
      
      if (this.mode === 'production' && code === '123456' && !hasActiveApiKey) {
          return { success: false, error: 'OTP bypass is strictly disabled in production mode.' };
      }

      // Get the latest active OTP for this phone
      const otpsRef = adminDb.collection('phone_verifications')
        .where('phone', '==', formattedPhone);
        
      const snapshot = await otpsRef.get();
      
      if (snapshot.empty) {
        return { success: false, error: 'No active OTP found for this phone number. Please request a new OTP.' };
      }

      const sortedDocs = snapshot.docs.sort((a, b) => (b.data().createdAt || 0) - (a.data().createdAt || 0));
      const otpDoc = sortedDocs[0];
      const otpData = otpDoc.data();
      const now = Date.now();

      // Check expiry
      if (now > otpData.expiresAt) {
        await otpDoc.ref.delete();
        return { success: false, error: 'OTP has expired. Please request a new one.' };
      }

      // Check retry attempts (Max 5)
      if ((otpData.attempts || 0) >= 5) {
        await otpDoc.ref.delete();
        return { success: false, error: 'Maximum verification attempts exceeded. Please request a new OTP.' };
      }

      // Verify hash using bcrypt
      const isValid = await bcrypt.compare(code.trim(), otpData.hashedOtp);

      if (!isValid) {
        const nextAttempts = (otpData.attempts || 0) + 1;
        await otpDoc.ref.update({
          attempts: nextAttempts
        });
        const remaining = 5 - nextAttempts;
        return { 
          success: false, 
          error: remaining > 0 ? `Invalid OTP. ${remaining} attempts remaining.` : 'Invalid OTP. Maximum attempts reached.' 
        };
      }

      // Success: Delete the OTP document so it cannot be replayed
      await otpDoc.ref.delete();

      return {
        success: true,
        phone: formattedPhone,
        provider: 'fast2sms'
      };

    } catch (error: any) {
      console.error('[Fast2SMS Verify] Exception:', error.message);
      return { success: false, error: 'An unexpected error occurred while verifying OTP.' };
    }
  }

  public async checkBalance(): Promise<{ success: boolean; balance?: string; error?: string }> {
    if (!this.apiKey || this.apiKey.trim().length === 0) {
      return { success: false, error: 'FAST2SMS_API_KEY is not configured' };
    }
    try {
      const res = await axios.post('https://www.fast2sms.com/dev/wallet', {}, {
        headers: {
          authorization: this.apiKey
        },
        timeout: 10000
      });
      if (res.data && res.data.wallet !== undefined) {
        return { success: true, balance: String(res.data.wallet) };
      }
      return { success: true, balance: 'Available' };
    } catch (err: any) {
      return { success: false, error: err.response?.data?.message || err.message };
    }
  }
}

