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

export default router;
