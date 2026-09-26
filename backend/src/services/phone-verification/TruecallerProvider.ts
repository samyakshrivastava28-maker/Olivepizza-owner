import axios from 'axios';
import crypto from 'crypto';
import { PhoneVerificationProvider, VerificationResult } from './PhoneVerificationProvider.js';
import { adminDb, adminAuth } from '../../config/firebase.js';

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
  verifiedAt?: number;
  error?: string;
  customToken?: string;
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

  public isConfigured(): boolean {
    return Boolean(this.CLIENT_ID && this.CLIENT_ID.length > 5);
  }

  public getClientId(): string {
    return this.CLIENT_ID;
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

    // Persist to Firestore asynchronously for multi-instance / webhook reliability
    adminDb.collection('truecaller_web_sessions').doc(requestId).set({
      ...session,
      updatedAt: now
    }).catch(err => {
      console.warn('[Truecaller] Firestore session creation warning:', err?.message);
    });

    return session;
  }

  /**
   * Retrieves a Web verification session (checks in-memory first, then Firestore)
   */
  public async getWebSession(requestId: string): Promise<TruecallerWebSession | null> {
    const memSession = this.webSessions.get(requestId);
    if (memSession && memSession.expiresAt < Date.now()) {
      this.webSessions.delete(requestId);
      return null;
    }

    if (memSession && memSession.status === 'VERIFIED') {
      return memSession;
    }

    // Check Firestore if missing or still PENDING
    try {
      const snap = await adminDb.collection('truecaller_web_sessions').doc(requestId).get();
      if (snap.exists) {
        const firestoreData = snap.data() as TruecallerWebSession;
        if (firestoreData.expiresAt && firestoreData.expiresAt >= Date.now()) {
          this.webSessions.set(requestId, firestoreData);
          return firestoreData;
        }
      }
    } catch (err: any) {
      console.warn('[Truecaller] Firestore session fetch error:', err?.message);
    }

    return memSession || null;
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

    // Check if session requestId is provided (Web QR / Deep link flow)
    if (payload.requestId) {
      const session = await this.getWebSession(payload.requestId);
      if (session && session.status === 'VERIFIED' && session.phone) {
        if (expectedPhone && this.normalizeE164(session.phone) !== this.normalizeE164(expectedPhone)) {
          return {
            success: false,
            error: `Verified number (${session.phone}) does not match expected account number (${expectedPhone}).`
          };
        }
        return {
          success: true,
          phone: session.phone,
          provider: 'truecaller',
          name: session.name || '',
          country: session.country || 'IN',
          verifiedAt: session.verifiedAt || Date.now()
        };
      }
    }

    if (typeof payload === 'string') {
      return { success: false, error: 'Truecaller signature required.' };
    }
    if (payload.payload && payload.signature) {
      return this.verifyNativePayload(payload.payload, payload.signature, payload.signatureAlgorithm, expectedPhone);
    }
    return { success: false, error: 'Unrecognized or unverified Truecaller payload format. Cryptographic verification required.' };
  }

  /**
   * Completes a web session callback (handles both Truecaller Web SDK accessToken+endpoint and RSA signed payload)
   */
  public async handleWebCallback(
    requestId: string,
    payloadOrOptions: any,
    signature?: string
  ): Promise<VerificationResult> {
    let session = await this.getWebSession(requestId);
    if (!session) {
      // Retry after 350ms to handle Firestore eventual consistency / replication
      await new Promise(r => setTimeout(r, 350));
      session = await this.getWebSession(requestId);
    }
    if (!session) {
      console.warn(`[Truecaller Callback] Session ${requestId} not found in memory or Firestore.`);
      return { success: false, error: 'Session not found or expired.' };
    }

    // 1. Truecaller Web SDK Format: { accessToken, endpoint }
    const accessToken = payloadOrOptions?.accessToken || (typeof payloadOrOptions === 'object' ? payloadOrOptions.accessToken : undefined);
    const endpoint = payloadOrOptions?.endpoint || (typeof payloadOrOptions === 'object' ? payloadOrOptions.endpoint : undefined) || 'https://profile4-noneu.truecaller.com/v1/default';

    if (accessToken && endpoint) {
      try {
        console.log(`[Truecaller Callback] Fetching profile from ${endpoint} for request ${requestId}`);
        const response = await axios.get(endpoint, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json'
          },
          timeout: 10000
        });

        const profile = response.data;
        if (!profile) {
          throw new Error('Empty profile response from Truecaller API.');
        }

        // Parse phone number from various Truecaller response formats
        const rawPhone = (
          (Array.isArray(profile.phoneNumbers) && profile.phoneNumbers[0]) ||
          profile.phone_number ||
          profile.phoneNumber ||
          ''
        ).toString();

        if (!rawPhone) {
          throw new Error('No phone number returned in Truecaller profile.');
        }

        const formattedPhone = this.normalizeE164(rawPhone);

        // Validate against expectedPhone if requested
        if (session.expectedPhone) {
          const normalizedExpected = this.normalizeE164(session.expectedPhone);
          if (formattedPhone !== normalizedExpected) {
            session.status = 'FAILED';
            session.error = `The verified phone number (${formattedPhone}) does not match expected account number (${normalizedExpected}).`;
            this.webSessions.set(requestId, session);
            await adminDb.collection('truecaller_web_sessions').doc(requestId).set({ ...session, updatedAt: Date.now() }).catch(() => {});
            return {
              success: false,
              error: session.error
            };
          }
        }

        const firstName = profile.firstName || profile.given_name || '';
        const lastName = profile.lastName || profile.family_name || '';
        const name = (profile.name || `${firstName} ${lastName}`.trim()) || 'Truecaller User';
        const country = profile.phone_number_country_code || (Array.isArray(profile.addresses) && profile.addresses[0]?.countryCode) || profile.countryCode || 'IN';
        const now = Date.now();

        session.status = 'VERIFIED';
        session.phone = formattedPhone;
        session.name = name;
        session.country = country;
        session.verifiedAt = now;
        session.error = undefined;

        // Auto-resolve or create user and generate customToken for immediate frontend login
        try {
          const { uid, customToken } = await this.resolveUserAndCreateToken(formattedPhone, name, session.userId);
          session.userId = uid;
          session.customToken = customToken;
        } catch (tokenErr: any) {
          console.warn('[Truecaller Callback] Custom token creation notice:', tokenErr?.message);
        }

        this.webSessions.set(requestId, session);

        await adminDb.collection('truecaller_web_sessions').doc(requestId).set({
          ...session,
          updatedAt: now
        }).catch(err => {
          console.warn('[Truecaller] Firestore session verified update error:', err?.message);
        });

        console.log(`[Truecaller Callback] Session ${requestId} verified successfully for ${formattedPhone}`);
        return {
          success: true,
          phone: formattedPhone,
          name,
          country,
          provider: 'truecaller',
          verifiedAt: now
        };
      } catch (err: any) {
        console.error('[Truecaller Callback] Error retrieving profile:', err.message);
        session.status = 'FAILED';
        session.error = err.response?.data?.message || err.message || 'Failed to retrieve Truecaller profile.';
        this.webSessions.set(requestId, session);
        await adminDb.collection('truecaller_web_sessions').doc(requestId).set({ ...session, updatedAt: Date.now() }).catch(() => {});
        return { success: false, error: session.error };
      }
    }

    // 2. Native RSA Format: payload + signature
    const payloadStr = typeof payloadOrOptions === 'string' ? payloadOrOptions : payloadOrOptions?.payload;
    const sig = signature || payloadOrOptions?.signature;

    if (payloadStr && sig) {
      const result = await this.verifyNativePayload(payloadStr, sig, undefined, session.expectedPhone);
      const now = Date.now();
      if (result.success && result.phone) {
        session.status = 'VERIFIED';
        session.phone = result.phone;
        session.name = (result as any).name;
        session.country = (result as any).country;
        session.verifiedAt = now;
        session.error = undefined;

        try {
          const { uid, customToken } = await this.resolveUserAndCreateToken(result.phone, (result as any).name, session.userId);
          session.userId = uid;
          session.customToken = customToken;
        } catch (tokenErr: any) {
          console.warn('[Truecaller Callback] Custom token creation notice:', tokenErr?.message);
        }

        this.webSessions.set(requestId, session);
        await adminDb.collection('truecaller_web_sessions').doc(requestId).set({ ...session, updatedAt: now }).catch(() => {});
      } else {
        session.status = 'FAILED';
        session.error = result.error;
        this.webSessions.set(requestId, session);
        await adminDb.collection('truecaller_web_sessions').doc(requestId).set({ ...session, updatedAt: now }).catch(() => {});
      }
      return result;
    }

    return {
      success: false,
      error: 'Unrecognized Truecaller callback parameters. Expected accessToken+endpoint or payload+signature.'
    };
  }

  private async resolveUserAndCreateToken(
    phone: string,
    name?: string,
    existingUid?: string
  ): Promise<{ uid: string; customToken: string }> {
    let uid = existingUid && !existingUid.startsWith('anon_') ? existingUid : null;

    if (!uid) {
      try {
        const userRecord = await adminAuth.getUserByPhoneNumber(phone);
        uid = userRecord.uid;
      } catch (err: any) {
        if (err.code === 'auth/user-not-found') {
          const newUser = await adminAuth.createUser({
            phoneNumber: phone,
            displayName: name || 'Customer',
          });
          uid = newUser.uid;
        } else {
          throw err;
        }
      }
    }

    // Strictly enforce role: customer
    await adminAuth.setCustomUserClaims(uid, { role: 'customer' }).catch(() => {});
    const customToken = await adminAuth.createCustomToken(uid, { role: 'customer' });

    // Ensure Firestore profile is synced
    await adminDb.collection('users').doc(uid).set({
      phone,
      phoneVerified: true,
      phoneSetupCompleted: true,
      verificationMethod: 'truecaller',
      role: 'customer',
      updatedAt: new Date().toISOString(),
      ...(name ? { name, displayName: name } : {}),
    }, { merge: true }).catch((err) => {
      console.warn('[Truecaller] Profile sync notice:', err.message);
    });

    return { uid, customToken };
  }
}
