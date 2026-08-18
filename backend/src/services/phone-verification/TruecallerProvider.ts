import axios from 'axios';
import crypto from 'crypto';
import { PhoneVerificationProvider, VerificationResult } from './PhoneVerificationProvider.js';

interface TruecallerKey {
  keyType: string;
  key: string;
}

export interface TruecallerWebSession {
  requestId: string;
  status: 'PENDING' | 'VERIFIED' | 'FAILED';
  expectedPhone?: string;
  userId?: string;
  phone?: string;
  name?: string;
  country?: string;
  deepLink?: string;
  createdAt: number;
  expiresAt: number;
  error?: string;
}

export class TruecallerProvider implements PhoneVerificationProvider {
  private publicKeys: TruecallerKey[] = [];
  private lastKeyFetch: number = 0;
  private readonly KEY_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private webSessions: Map<string, TruecallerWebSession> = new Map();
  private readonly CLIENT_ID = process.env.TRUECALLER_CLIENT_ID || 'um2vaxqdcr3nroydqvyg_hahzikmqrla8w_yxiptsry';

  constructor() {
    // Periodic session cleanup
    setInterval(() => {
      const now = Date.now();
      for (const [id, session] of this.webSessions.entries()) {
        if (session.expiresAt < now) {
          this.webSessions.delete(id);
        }
      }
    }, 5 * 60 * 1000);
  }

  public normalizeE164(phone: string): string {
    if (!phone) return '';
    let cleaned = phone.replace(/[^0-9+]/g, '').trim();
    if (!cleaned.startsWith('+')) {
      if (cleaned.length === 10) {
        cleaned = `+91${cleaned}`;
      } else if (cleaned.length === 12 && cleaned.startsWith('91')) {
        cleaned = `+${cleaned}`;
      } else {
        cleaned = `+91${cleaned}`;
      }
    }
    return cleaned;
  }

  private async getPublicKeys(): Promise<TruecallerKey[]> {
    const now = Date.now();
    if (this.publicKeys.length > 0 && now - this.lastKeyFetch < this.KEY_CACHE_DURATION) {
      return this.publicKeys;
    }

    try {
      const response = await axios.get('https://api4.truecaller.com/v1/key', { timeout: 5000 });
      if (Array.isArray(response.data)) {
        this.publicKeys = response.data;
        this.lastKeyFetch = now;
        return this.publicKeys;
      }
      throw new Error('Invalid key format received from Truecaller');
    } catch (error: any) {
      console.error('[Truecaller] Error fetching public keys:', error.message);
      // Return cached keys if available on network blip
      if (this.publicKeys.length > 0) return this.publicKeys;
      throw error;
    }
  }

  /**
   * Creates a Web / Desktop QR verification session
   */
  public createWebSession(expectedPhone?: string, userId?: string): TruecallerWebSession {
    const requestId = crypto.randomBytes(16).toString('hex');
    const now = Date.now();
    const expiresAt = now + 5 * 60 * 1000; // 5 minutes validity

    const normalizedExpected = expectedPhone ? this.normalizeE164(expectedPhone) : undefined;
    const deepLink = `truecallersdk://truesdk/web_verify?requestNonce=${requestId}&partnerKey=${encodeURIComponent(this.CLIENT_ID)}&partnerName=Olive%20Pizza&lang=en&title=Verify%20Number`;

    const session: TruecallerWebSession = {
      requestId,
      status: 'PENDING',
      expectedPhone: normalizedExpected,
      userId,
      deepLink,
      createdAt: now,
      expiresAt
    };

    this.webSessions.set(requestId, session);
    return session;
  }

  /**
   * Retrieves a Web verification session
   */
  public getWebSession(requestId: string): TruecallerWebSession | null {
    const session = this.webSessions.get(requestId);
    if (!session) return null;
    if (session.expiresAt < Date.now()) {
      this.webSessions.delete(requestId);
      return null;
    }
    return session;
  }

  /**
   * Verifies Native or Web Base64 payload against Truecaller public keys
   */
  public async verifyNativePayload(
    payloadBase64: string,
    signature: string,
    signatureAlgorithm?: string,
    expectedPhone?: string
  ): Promise<VerificationResult> {
    try {
      // 1. Decode Payload
      const payloadString = Buffer.from(payloadBase64, 'base64').toString('utf8');
      const payload = JSON.parse(payloadString);

      // 2. Validate Replay/Timestamp
      const requestTime = payload.requestTime; // Unix timestamp
      const now = Date.now();
      // Allow 5 minutes of clock drift/validity
      if (!requestTime || Math.abs(now - requestTime) > 5 * 60 * 1000) {
        return { success: false, error: 'Verification request expired or timestamp invalid.' };
      }

      // 3. Fetch Keys
      const keys = await this.getPublicKeys();
      if (!keys || keys.length === 0) {
        return { success: false, error: 'Failed to fetch Truecaller validation keys.' };
      }

      // 4. Verify Signature
      const rawAlgo = signatureAlgorithm || 'SHA512withRSA';
      let nodeAlgo = 'SHA512';
      if (/sha256/i.test(rawAlgo)) nodeAlgo = 'SHA256';
      else if (/sha1/i.test(rawAlgo)) nodeAlgo = 'SHA1';

      const signatureBuffer = Buffer.from(signature, 'base64');
      
      let verified = false;
      for (const key of keys) {
        let pem = key.key;
        if (!pem.includes('BEGIN PUBLIC KEY')) {
          const lines = pem.match(/.{1,64}/g)?.join('\n') || pem;
          pem = `-----BEGIN PUBLIC KEY-----\n${lines}\n-----END PUBLIC KEY-----\n`;
        }
        
        try {
          const verifier = crypto.createVerify(nodeAlgo);
          verifier.update(payloadBase64);
          
          if (verifier.verify(pem, signatureBuffer)) {
            verified = true;
            break;
          }
        } catch {
          // Try next key
        }
      }

      if (!verified) {
        return { success: false, error: 'Invalid Truecaller signature.' };
      }

      // 5. Normalization & Matching
      const rawPhone = payload.phoneNumber;
      const formattedPhone = this.normalizeE164(rawPhone);

      if (expectedPhone) {
        const normalizedExpected = this.normalizeE164(expectedPhone);
        if (formattedPhone !== normalizedExpected) {
          return {
            success: false,
            error: `The verified phone number (${formattedPhone}) does not match the number on this Olive Pizza account (${normalizedExpected}).`
          };
        }
      }

      return {
        success: true,
        phone: formattedPhone,
        provider: 'truecaller',
        name: `${payload.firstName || ''} ${payload.lastName || ''}`.trim(),
        country: payload.countryCode || 'IN'
      };

    } catch (error: any) {
      console.error('[Truecaller Verify] Exception:', error.message);
      return { success: false, error: 'Truecaller verification failed due to internal error.' };
    }
  }

  /**
   * Verifies profile payload from native or web SDK
   */
  public async verifyProfile(payload: any, _uid?: string, expectedPhone?: string): Promise<VerificationResult> {
    if (!payload) {
      return { success: false, error: 'Payload is required.' };
    }

    // Check if session requestId is provided
    if (payload.requestId && this.webSessions.has(payload.requestId)) {
      const session = this.webSessions.get(payload.requestId)!;
      if (session.status === 'VERIFIED' && session.phone) {
        return {
          success: true,
          phone: session.phone,
          provider: 'truecaller',
          name: session.name || '',
          country: session.country || 'IN'
        };
      }
    }

    if (typeof payload === 'string') {
      return this.verifyNativePayload(payload, payload, undefined, expectedPhone);
    }
    if (payload.payload && payload.signature) {
      return this.verifyNativePayload(payload.payload, payload.signature, payload.signatureAlgorithm, expectedPhone);
    }
    if (payload.phoneNumber || payload.phone) {
      const formattedPhone = this.normalizeE164(payload.phoneNumber || payload.phone || '');
      
      if (expectedPhone) {
        const normalizedExpected = this.normalizeE164(expectedPhone);
        if (formattedPhone !== normalizedExpected) {
          return {
            success: false,
            error: `The verified phone number (${formattedPhone}) does not match the number on this Olive Pizza account (${normalizedExpected}).`
          };
        }
      }

      return {
        success: true,
        phone: formattedPhone,
        provider: 'truecaller',
        name: `${payload.firstName || payload.name || ''} ${payload.lastName || ''}`.trim(),
        country: payload.countryCode || 'IN'
      };
    }
    return { success: false, error: 'Unrecognized Truecaller payload format.' };
  }

  /**
   * Completes a web session callback
   */
  public async handleWebCallback(requestId: string, payload: any, signature: string): Promise<VerificationResult> {
    const session = this.getWebSession(requestId);
    if (!session) {
      return { success: false, error: 'Session not found or expired.' };
    }

    const result = await this.verifyNativePayload(payload, signature, undefined, session.expectedPhone);
    if (result.success && result.phone) {
      session.status = 'VERIFIED';
      session.phone = result.phone;
      session.name = (result as any).name;
      session.country = (result as any).country;
      this.webSessions.set(requestId, session);
    } else {
      session.status = 'FAILED';
      session.error = result.error;
      this.webSessions.set(requestId, session);
    }
    return result;
  }
}
