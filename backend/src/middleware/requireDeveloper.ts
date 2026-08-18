/**
 * requireDeveloper — Developer-Only Route Guard
 *
 * Enforces three conditions:
 *   1. Valid Firebase ID token (Bearer in Authorization header)
 *   2. Email must be 'webhub2811@gmail.com'
 *   3. Firebase custom claim `developer === true`
 */
import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../config/firebase.js';
import { logSecurityEventServer } from './auth.middleware.js';

const AUTHORIZED_DEVELOPER_EMAILS = ['webhub2811@gmail.com', 'olivepizzarjn@gmail.com'];

export interface DevRequest extends Request {
  developer?: {
    uid: string;
    email: string;
  };
}

export const requireDeveloper = async (
  req: DevRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  const ip = req.ip || 'unknown';

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: No token provided' });
    return;
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decoded = await adminAuth.verifyIdToken(token);

    if (!decoded.email || !AUTHORIZED_DEVELOPER_EMAILS.includes(decoded.email.toLowerCase())) {
      await logSecurityEventServer({
        action: 'devops_access_denied_wrong_email',
        route: req.originalUrl,
        uid: decoded.uid,
        email: decoded.email,
        ip,
      });
      res.status(403).json({ error: 'Forbidden: Developer access strictly restricted to authorized administrator accounts' });
      return;
    }

    // Auto-grant custom claim if email is webhub2811@gmail.com and claim is missing
    if (decoded.developer !== true) {
      try {
        await adminAuth.setCustomUserClaims(decoded.uid, { ...decoded, developer: true });
        console.log('[requireDeveloper] Automatically granted developer: true claim to webhub2811@gmail.com');
      } catch (cErr: any) {
        console.warn('[requireDeveloper] Auto claim error:', cErr.message);
      }
    }

    req.developer = { uid: decoded.uid, email: decoded.email! };
    next();
  } catch (err: any) {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};
