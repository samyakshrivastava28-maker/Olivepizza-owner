/**
 * Fast2SmsService.ts — Official Fast2SMS OTP Transport Gateway
 *
 * Implements real SMS dispatch for OTP verification via Fast2SMS DLT / Quick SMS API.
 * Fails transparently with explicit error reporting if API keys are missing or invalid.
 */

import axios from 'axios';
import { normalizePhone } from '../../utils/phoneNormalization.js';

export interface SmsSendResult {
  success: boolean;
  message: string;
  requestId?: string;
  error?: string;
}

export class Fast2SmsService {
  private static readonly API_URL = 'https://www.fast2sms.com/dev/bulkV2';

  public static isConfigured(): boolean {
    const key = process.env.FAST2SMS_API_KEY;
    return Boolean(key && key.trim().length > 10);
  }

  /**
   * Dispatches a 4-digit or 6-digit OTP to an Indian mobile number via Fast2SMS
   */
  public static async sendOtp(phone: string, otpCode: string): Promise<SmsSendResult> {
    const norm = normalizePhone(phone);
    if (!norm.isValid || !norm.national) {
      return {
        success: false,
        message: 'Invalid phone number format. A valid 10-digit mobile number is required.',
        error: 'INVALID_PHONE_FORMAT'
      };
    }

    const apiKey = process.env.FAST2SMS_API_KEY;

    if (!apiKey) {
      // In development / testing environment, report clearly that SMS gateway is not configured
      const isDev = process.env.NODE_ENV !== 'production' || process.env.PHONE_AUTH_MODE === 'development';
      if (isDev) {
        console.log(`[Fast2SMS Simulator] Dev mode: OTP for ${norm.e164} is [${otpCode}]`);
        return {
          success: true,
          message: 'Development mode: SMS simulated.',
          requestId: `sim_${Date.now()}`
        };
      }

      return {
        success: false,
        message: 'SMS gateway is not configured. Missing FAST2SMS_API_KEY.',
        error: 'SMS_GATEWAY_NOT_CONFIGURED'
      };
    }

    try {
      const response = await axios.post(
        this.API_URL,
        {
          route: 'otp',
          variables_values: otpCode,
          numbers: norm.national
        },
        {
          headers: {
            authorization: apiKey.trim(),
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      const data = response.data;
      if (data && (data.return === true || data.status_code === 200)) {
        return {
          success: true,
          message: 'OTP sent successfully via SMS.',
          requestId: data.request_id || `f2s_${Date.now()}`
        };
      }

      console.warn('[Fast2SMS] API rejected request:', data);
      return {
        success: false,
        message: data.message || 'SMS provider rejected request.',
        error: 'FAST2SMS_REJECTED'
      };
    } catch (err: any) {
      console.error('[Fast2SMS] Gateway connection error:', err.response?.data || err.message);
      return {
        success: false,
        message: err.response?.data?.message || err.message || 'Failed to connect to SMS provider gateway.',
        error: 'GATEWAY_ERROR'
      };
    }
  }
}

export default Fast2SmsService;
