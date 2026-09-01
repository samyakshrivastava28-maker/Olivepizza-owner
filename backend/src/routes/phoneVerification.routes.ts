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
