import express, { Request, Response } from 'express';
import { adminDb, adminAuth } from '../config/firebase.js';
import { phoneVerificationService } from '../services/phone-verification/PhoneVerificationService.js';
import { authLimiter } from '../config/security.config.js';

const router = express.Router();
const truecaller = phoneVerificationService.getTruecallerProvider();

// Authentication Middleware with fallback to body/header UID
const authenticateUser = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.headers.authorization?.split('Bearer ')[1];
  let userUid = req.body?.userId || (req.headers['x-user-uid'] as string);

  if (token) {
    try {
      const decoded = await adminAuth.verifyIdToken(token, false);
      (req as any).user = decoded;
      return next();
    } catch (error) {
      console.warn('[PhoneVerification] Token verification fallback:', error);
    }
  }

  (req as any).user = { uid: userUid || `anon_${Date.now()}` };
  next();
};

// Public/Semi-public Web Session Management for Truecaller
router.post('/truecaller/session', authLimiter, authenticateUser, async (req: Request, res: Response) => {
  try {
    const { expectedPhone } = req.body;
    const uid = (req as any).user?.uid;
    const session = truecaller.createWebSession(expectedPhone, uid);
    return res.json({
      success: true,
      requestId: session.requestId,
      deepLink: session.deepLink,
      expiresAt: session.expiresAt
    });
  } catch (error: any) {
    console.error('[PhoneVerification] Create Truecaller session error:', error);
    return res.status(500).json({ success: false, error: 'Failed to create Truecaller verification session.' });
  }
});

router.get('/truecaller/session/:requestId', authLimiter, async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const session = truecaller.getWebSession(requestId);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found or expired.' });
    }
    return res.json({
      success: true,
      status: session.status,
      phone: session.phone,
      error: session.error,
      name: session.name,
      country: session.country
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: 'Failed to query Truecaller session.' });
  }
});

router.post('/truecaller/callback', authLimiter, async (req: Request, res: Response) => {
  try {
    const { requestId, payload, signature } = req.body;
    if (!requestId || !payload || !signature) {
      return res.status(400).json({ success: false, error: 'Missing required callback fields.' });
    }
    const result = await truecaller.handleWebCallback(requestId, payload, signature);
    return res.json(result);
  } catch (error: any) {
    console.error('[PhoneVerification] Truecaller callback error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Callback verification failed.' });
  }
});

router.use(authenticateUser);

router.post('/send-otp', authLimiter, async (req: Request, res: Response) => {
  try {
    const { phoneNumber } = req.body;
    const uid = (req as any).user?.uid || req.body?.userId || 'anonymous';
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

    if (!phoneNumber) {
      return res.status(400).json({ success: false, error: 'Phone number is required.' });
    }

    const result = await phoneVerificationService.sendOtp(phoneNumber, uid, clientIp);
    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error: any) {
    console.error('[PhoneVerification] send-otp error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal server error while sending OTP.' });
  }
});

router.post('/verify-otp', authLimiter, async (req: Request, res: Response) => {
  try {
    const { phoneNumber, otp, pinId, userId } = req.body;
    const uid = userId || (req as any).user?.uid;

    if (!phoneNumber || !otp) {
      return res.status(400).json({ success: false, error: 'Phone number and OTP code are required.' });
    }

    const result = await phoneVerificationService.verifyOtp(phoneNumber, otp, uid, pinId);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    if (result.success && uid && !uid.startsWith('anon_')) {
      try {
        const userRef = adminDb.collection('users').doc(uid);
        await userRef.set({
          phone: result.phone,
          phoneVerified: true,
          verificationMethod: result.provider || 'infobip',
          verifiedAt: result.verifiedAt || Date.now(),
          phoneSetupCompleted: true
        }, { merge: true });
        
        const identityRef = adminDb.collection('customer_identities').doc(result.phone!);
        await identityRef.set({
          primaryUid: uid,
          verifiedAt: Date.now()
        }, { merge: true });
      } catch (e: any) {
        console.warn('[PhoneVerification] Firestore update warning:', e.message);
      }
    }

    return res.json(result);
  } catch (error: any) {
    console.error('[PhoneVerification] verify-otp error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal server error while verifying OTP.' });
  }
});

router.post('/truecaller', authLimiter, async (req: Request, res: Response) => {
  const { payload, signature, signatureAlgorithm, expectedPhone, requestId } = req.body;
  const uid = (req as any).user?.uid;
  
  try {
    const verifyInput = payload ? (typeof payload === 'string' && signature ? { payload, signature, signatureAlgorithm } : payload) : { requestId };
    const result = await truecaller.verifyProfile(verifyInput, uid, expectedPhone);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    if (result.success && uid && !uid.startsWith('anon_')) {
      const userRef = adminDb.collection('users').doc(uid);
      await userRef.set({
        phone: result.phone,
        phoneVerified: true,
        verificationMethod: 'truecaller',
        verifiedAt: Date.now(),
        truecallerName: (result as any).name || null,
        truecallerCountry: (result as any).country || 'IN',
        phoneSetupCompleted: true
      }, { merge: true });

      const identityRef = adminDb.collection('customer_identities').doc(result.phone!);
      await identityRef.set({
        primaryUid: uid,
        verifiedAt: Date.now()
      }, { merge: true });
    }

    return res.json(result);
  } catch (e: any) {
    console.error('[PhoneVerification] Truecaller endpoint exception:', e);
    return res.status(500).json({ success: false, error: e.message || 'Truecaller verification failed.' });
  }
});

router.post('/signin', authLimiter, async (req: Request, res: Response) => {
  const { method, phoneNumber, otp, pinId, requestId, payload, signature } = req.body;

  try {
    let verifiedPhone: string | null = null;
    let verifiedName: string | null = null;

    if (method === 'sms') {
      if (!phoneNumber || !otp) {
        return res.status(400).json({ success: false, error: 'Phone number and OTP code are required.' });
      }
      const verifyRes = await phoneVerificationService.verifyOtp(phoneNumber, otp, 'phone_signin', pinId);
      if (!verifyRes.success || !verifyRes.phone) {
        return res.status(400).json({ success: false, error: verifyRes.error || 'Invalid OTP code.' });
      }
      verifiedPhone = verifyRes.phone;
    } else if (method === 'truecaller') {
      const verifyInput = payload ? (typeof payload === 'string' && signature ? { payload, signature } : payload) : { requestId };
      const tcRes = await truecaller.verifyProfile(verifyInput, 'phone_signin');
      if (!tcRes.success || !tcRes.phone) {
        return res.status(400).json({ success: false, error: tcRes.error || 'Truecaller verification failed.' });
      }
      verifiedPhone = tcRes.phone;
      verifiedName = (tcRes as any).name || null;
    } else {
      return res.status(400).json({ success: false, error: 'Invalid verification method specified.' });
    }

    // Resolve or provision account
    let uid: string | null = null;
    let userData: any = null;
    let isNewUser = false;

    // 1. Check customer_identities
    const identSnap = await adminDb.collection('customer_identities').doc(verifiedPhone).get();
    if (identSnap.exists) {
      uid = identSnap.data()?.primaryUid || null;
    }

    // 2. Check users collection by phone
    if (!uid) {
      const userSnap = await adminDb.collection('users')
        .where('phone', '==', verifiedPhone)
        .limit(1)
        .get();
      if (!userSnap.empty) {
        uid = userSnap.docs[0].id;
        userData = userSnap.docs[0].data();
      }
    } else {
      const userDoc = await adminDb.collection('users').doc(uid).get();
      if (userDoc.exists) {
        userData = userDoc.data();
      }
    }

    // 3. If account does not exist, provision clean customer account
    if (!uid) {
      isNewUser = true;
      try {
        const createdFirebaseUser = await adminAuth.createUser({
          phoneNumber: verifiedPhone,
          displayName: verifiedName || 'Customer',
        });
        uid = createdFirebaseUser.uid;
      } catch (authErr: any) {
        if (authErr.code === 'auth/phone-number-already-exists') {
          const existing = await adminAuth.getUserByPhoneNumber(verifiedPhone);
          uid = existing.uid;
        } else {
          uid = 'cust_' + Buffer.from(verifiedPhone).toString('hex').slice(0, 20);
        }
      }

      await adminAuth.setCustomUserClaims(uid, { role: 'customer' }).catch(() => {});

      userData = {
        firebase_uid: uid,
        phone: verifiedPhone,
        phoneVerified: true,
        phoneSetupCompleted: true,
        role: 'customer',
        name: verifiedName || 'Customer',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        verificationMethod: method,
      };

      await adminDb.collection('users').doc(uid).set(userData, { merge: true });
    } else {
      await adminDb.collection('users').doc(uid).set({
        phone: verifiedPhone,
        phoneVerified: true,
        phoneSetupCompleted: true,
        updatedAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      }, { merge: true });
    }

    // Update customer_identities
    await adminDb.collection('customer_identities').doc(verifiedPhone).set({
      primaryUid: uid,
      verifiedAt: Date.now(),
    }, { merge: true });

    // Generate custom token for client-side Firebase Auth sign-in
    const customToken = await adminAuth.createCustomToken(uid, { role: userData?.role || 'customer' });

    return res.json({
      success: true,
      customToken,
      user: {
        uid,
        phone: verifiedPhone,
        name: userData?.name || verifiedName || 'Customer',
        email: userData?.email || null,
        role: userData?.role || 'customer',
        phoneVerified: true,
      },
      isNewUser,
    });
  } catch (err: any) {
    console.error('[PhoneVerification] signin error:', err);
    return res.status(500).json({ success: false, error: 'Sign in with phone failed. Please try again.' });
  }
});

router.get('/status', async (_req: Request, res: Response) => {
  const health = await phoneVerificationService.getHealthStatus();
  res.json({
    success: true,
    service: 'Infobip 2FA OTP & Truecaller Verification Service',
    infobip: health.infobip,
    truecaller: health.truecaller
  });
});

export default router;
