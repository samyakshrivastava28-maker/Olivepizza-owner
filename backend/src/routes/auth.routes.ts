import { Router, Request, Response } from 'express';
import { RecaptchaEnterpriseServiceClient } from '@google-cloud/recaptcha-enterprise';

const router = Router();
let client: RecaptchaEnterpriseServiceClient | null = null;
try {
  client = new RecaptchaEnterpriseServiceClient();
} catch (e) {
  console.warn("Could not initialize Recaptcha client:", e);
}

router.post('/verify-recaptcha', async (req: Request, res: Response) => {
  try {
    const { token, action } = req.body;
    if (!token) {
      res.status(400).json({ success: false, error: 'Token missing' });
      return;
    }

    if (!client) {
      res.status(503).json({ success: false, error: 'recaptcha_service_unavailable' });
      return;
    }

    const projectID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'olive-pizza-08';
    const recaptchaKey = process.env.RECAPTCHA_SITE_KEY || '6LdqyDctAAAAABn8isXOdDe-0roVqILKuAdIl_x-';
    
    const projectPath = client.projectPath(projectID);

    const request = {
      assessment: {
        event: {
          token: token,
          siteKey: recaptchaKey,
        },
      },
      parent: projectPath,
    };

    const [response] = await client.createAssessment(request);

    if (!response.tokenProperties?.valid) {
      console.warn(`[reCAPTCHA] Assessment failed: invalidReason=${response.tokenProperties?.invalidReason}`);
      res.status(400).json({ success: false, error: response.tokenProperties?.invalidReason || 'invalid_token' });
      return;
    }

    if (action && response.tokenProperties.action !== action) {
      console.warn(`[reCAPTCHA] Action mismatch: expected=${action} got=${response.tokenProperties.action}`);
      res.status(400).json({ success: false, error: 'action_mismatch' });
      return;
    }

    const score = response.riskAnalysis?.score ?? 0;
    console.log(`[reCAPTCHA] Verification succeeded, score=${score}`);
    res.json({ success: true, score });
  } catch (error: any) {
    console.error('[reCAPTCHA] Assessment error:', error.message);
    res.status(500).json({ success: false, error: 'recaptcha_assessment_failed' });
  }
});


import { verifyToken, requireRole, AuthRequest } from '../middleware/auth.middleware.js';
import { FranchiseScopeService } from '../services/franchise/FranchiseScopeService.js';
import { TOTPService } from '../services/auth/TOTPService.js';
import { adminDb } from '../config/firebase.js';

// POST /api/auth/context-session - Owner Authorized Context Switching for Standalone Apps
router.post('/context-session', verifyToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const isGlobalOwner = FranchiseScopeService.isGlobalOwner(user.email, user.role);
    if (!isGlobalOwner) {
      res.status(403).json({ error: 'Forbidden. Only platform Global Owner can create scoped management contexts.' });
      return;
    }

    const { targetApp, targetFranchiseId, targetBranchId, targetBranchName } = req.body;

    const tokenPayload = {
      ownerUid: user.uid,
      ownerEmail: user.email,
      targetApp: targetApp || 'restaurant_management',
      targetFranchiseId: targetFranchiseId || 'fra_primary',
      targetBranchId: targetBranchId || 'main_branch',
      targetBranchName: targetBranchName || 'Olive Pizza — Rajnandgaon HQ',
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() // 8 hour session
    };

    const sessionKey = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');

    let targetUrl = 'http://localhost:5176';
    if (targetApp === 'franchise') {
      targetUrl = `http://localhost:5175?context=${sessionKey}&franchiseId=${encodeURIComponent(tokenPayload.targetFranchiseId)}`;
    } else {
      targetUrl = `http://localhost:5176?context=${sessionKey}&branchId=${encodeURIComponent(tokenPayload.targetBranchId)}&branchName=${encodeURIComponent(tokenPayload.targetBranchName)}`;
    }

    res.json({
      success: true,
      sessionKey,
      targetUrl,
      context: tokenPayload
    });
  } catch (error: any) {
    console.error('[Auth] Error generating context session:', error);
    res.status(500).json({ error: error?.message || 'Failed to generate context session' });
  }
});

// ============================================================================
// 2FA / MFA (RFC 6238 TOTP Authenticator Engine for Owner & Staff)
// ============================================================================

// GET /api/auth/2fa/status - Query 2FA status for authenticated user
router.get('/2fa/status', verifyToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const snap = await adminDb.collection('user_2fa').doc(uid).get();
    const data = snap.exists ? snap.data() : null;
    res.json({
      success: true,
      enabled: Boolean(data?.enabled),
      enrolledAt: data?.enrolledAt || null,
      backupCodesRemaining: (data?.backupCodes || []).length
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/auth/2fa/enroll - Begin 2FA enrollment (Generates Secret + OtpAuth URI + Backup Codes)
router.post('/2fa/enroll', verifyToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const secret = TOTPService.generateSecret();
    const otpAuthUri = TOTPService.generateOtpAuthUri(secret, user.email || 'owner@olivepizza.in');
    const backupCodes = TOTPService.generateBackupCodes(8);
    const encryptedSecret = TOTPService.encryptSecret(secret);

    // Save pending enrollment in Firestore
    await adminDb.collection('user_2fa').doc(user.uid).set({
      encryptedSecret,
      backupCodes,
      enabled: false,
      pendingEnrollment: true,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    res.json({
      success: true,
      secret, // Sent once during enrollment for manual entry in Google Authenticator / Authy
      otpAuthUri,
      backupCodes
    });
  } catch (error: any) {
    console.error('[Auth 2FA] Enroll error:', error);
    res.status(500).json({ success: false, error: 'Failed to initiate 2FA enrollment' });
  }
});

// POST /api/auth/2fa/verify - Verify first code to activate 2FA
router.post('/2fa/verify', verifyToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const { code } = req.body;
    if (!user || !code) {
      res.status(400).json({ error: 'Verification code is required' });
      return;
    }

    const docRef = adminDb.collection('user_2fa').doc(user.uid);
    const snap = await docRef.get();
    if (!snap.exists) {
      res.status(404).json({ error: '2FA enrollment not found' });
      return;
    }

    const data = snap.data()!;
    const decryptedSecret = TOTPService.decryptSecret(data.encryptedSecret);
    const isValid = TOTPService.verifyTOTP(decryptedSecret, code);

    if (!isValid) {
      res.status(400).json({ success: false, error: 'Invalid 6-digit verification code. Ensure your device clock is synchronized.' });
      return;
    }

    await docRef.update({
      enabled: true,
      pendingEnrollment: false,
      enrolledAt: new Date().toISOString(),
      lastVerifiedAt: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Two-factor authentication successfully enabled'
    });
  } catch (error: any) {
    console.error('[Auth 2FA] Verification error:', error);
    res.status(500).json({ success: false, error: 'Failed to verify 2FA' });
  }
});

// POST /api/auth/2fa/validate-session - Validate TOTP code or backup code during login session
router.post('/2fa/validate-session', verifyToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const { code, isBackupCode } = req.body;
    if (!user || !code) {
      res.status(400).json({ error: 'Code is required' });
      return;
    }

    const docRef = adminDb.collection('user_2fa').doc(user.uid);
    const snap = await docRef.get();
    if (!snap.exists || !snap.data()?.enabled) {
      res.json({ success: true, required: false, message: '2FA not enabled on this account' });
      return;
    }

    if (isBackupCode) {
      const backupValid = await TOTPService.verifyAndBurnBackupCode(user.uid, code);
      if (!backupValid) {
        res.status(400).json({ success: false, error: 'Invalid or already consumed backup recovery code' });
        return;
      }
      res.json({ success: true, message: 'Authenticated via backup recovery code' });
      return;
    }

    const data = snap.data()!;
    const decryptedSecret = TOTPService.decryptSecret(data.encryptedSecret);
    const isValid = TOTPService.verifyTOTP(decryptedSecret, code);

    if (!isValid) {
      res.status(400).json({ success: false, error: 'Invalid 6-digit authentication code' });
      return;
    }

    await docRef.update({ lastVerifiedAt: new Date().toISOString() });

    res.json({
      success: true,
      message: '2FA session validated successfully'
    });
  } catch (error: any) {
    console.error('[Auth 2FA] Session validation error:', error);
    res.status(500).json({ success: false, error: 'Failed to validate 2FA session' });
  }
});

// POST /api/auth/2fa/disable - Disable 2FA with current code confirmation
router.post('/2fa/disable', verifyToken, requireRole(['owner', 'admin']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const { code } = req.body;
    if (!user || !code) {
      res.status(400).json({ error: 'Current 2FA code is required to disable' });
      return;
    }

    const docRef = adminDb.collection('user_2fa').doc(user.uid);
    const snap = await docRef.get();
    if (!snap.exists || !snap.data()?.enabled) {
      res.json({ success: true, message: '2FA already disabled' });
      return;
    }

    const data = snap.data()!;
    const decryptedSecret = TOTPService.decryptSecret(data.encryptedSecret);
    const isValid = TOTPService.verifyTOTP(decryptedSecret, code);

    if (!isValid) {
      res.status(400).json({ success: false, error: 'Invalid authentication code' });
      return;
    }

    await docRef.delete();
    res.json({ success: true, message: '2FA disabled successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'Failed to disable 2FA' });
  }
});

export default router;
