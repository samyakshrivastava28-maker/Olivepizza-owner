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

    // Bypass in development if no client is properly authenticated
    if (!client || process.env.NODE_ENV !== 'production') {
      res.json({ success: true, score: 0.9, reason: "dev_bypass" });
      return;
    }

    const projectID = process.env.GOOGLE_CLOUD_PROJECT_ID || "olive-pizza-08";
    const recaptchaKey = process.env.RECAPTCHA_SITE_KEY || "6LdqyDctAAAAABn8isXOdDe-0roVqILKuAdIl_x-";
    
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
      console.log(`The CreateAssessment call failed because the token was: ${response.tokenProperties?.invalidReason}`);
      // As requested, don't strictly block if it's a borderline issue, but let's return it
      res.json({ success: false, reason: response.tokenProperties?.invalidReason });
      return;
    }

    if (response.tokenProperties.action === action) {
      console.log(`The reCAPTCHA score is: ${response.riskAnalysis?.score}`);
      res.json({ success: true, score: response.riskAnalysis?.score });
      return;
    } else {
      console.log("The action attribute in your reCAPTCHA tag does not match");
      res.json({ success: false, reason: "action_mismatch" });
      return;
    }
  } catch (error) {
    console.error("Recaptcha assessment error:", error);
    // Don't block workflow on backend error as requested
    res.json({ success: true, error: "assessment_failed_but_allowed" });
  }
});


import { verifyToken, requireRole, AuthRequest } from '../middleware/auth.middleware.js';
import { FranchiseScopeService } from '../services/franchise/FranchiseScopeService.js';

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

export default router;
