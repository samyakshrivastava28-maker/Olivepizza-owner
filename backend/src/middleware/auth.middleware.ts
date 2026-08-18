import { Request, Response, NextFunction } from 'express';
import { adminAuth, adminDb } from '../config/firebase.js';

export async function logSecurityEventServer(params: {
  action: string;
  route: string;
  uid?: string;
  email?: string;
  role?: string;
  ip?: string;
}) {
  try {
    await adminDb.collection('security_logs').add({
      ...params,
      timestamp: new Date().toISOString(),
      source: 'backend_api'
    });
  } catch (error) {
    console.error('Failed to log security event on server:', error);
  }
}

export interface AuthRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    role: string;
  };
}

export const verifyToken = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: No token provided' });
    return;
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;
    
    // Read role from custom claims first, fallback to Firestore if missing or customer
    let role = (decodedToken.role as string);

    if (!role || role === 'customer') {
      if (decodedToken.email?.toLowerCase() === 'olivepizzarjn@gmail.com' || decodedToken.email?.toLowerCase() === 'webhub2811@gmail.com') {
        role = 'owner';
      } else {
        try {
          const userDoc = await adminDb.collection('users').doc(uid).get();
          if (userDoc.exists) {
            const userData = userDoc.data()!;
            if (userData.role) {
              role = userData.role;
            } else if (userData.isDeliveryPartner || userData.vehicleType || userData.vehicleNumber) {
              role = 'delivery_partner';
            }
          }
        } catch (dbErr) {
          console.warn('[AuthMiddleware] Failed to read fallback role from Firestore:', dbErr);
        }
      }
    }

    req.user = {
      uid,
      email: decodedToken.email,
      role: role || 'customer'
    };
    
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      await logSecurityEventServer({
        action: 'api_unauthorized_no_user',
        route: req.originalUrl,
        ip: req.ip
      });
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    const userRole = req.user.role || '';
    const AUTHORIZED_INTERNAL_EMAILS = ['olivepizzarjn@gmail.com', 'webhub2811@gmail.com'];
    const isInternalAccount = req.user.email && AUTHORIZED_INTERNAL_EMAILS.includes(req.user.email.toLowerCase());
    const isOwnerOrAdminRequested = allowedRoles.includes('owner') || allowedRoles.includes('admin');
    const isDeveloperAllowedForOwner = isOwnerOrAdminRequested && (userRole === 'developer' || isInternalAccount);
    const isDeliveryEquivalent = (r: string) => r === 'delivery' || r === 'delivery_partner';
    const hasRole = isDeveloperAllowedForOwner || allowedRoles.includes(userRole) || 
      (isDeliveryEquivalent(userRole) && allowedRoles.some(isDeliveryEquivalent));

    if (!hasRole) {
      await logSecurityEventServer({
         action: 'api_forbidden_insufficient_permissions',
         route: req.originalUrl,
         uid: req.user.uid,
         email: req.user.email,
         role: req.user.role,
         ip: req.ip
      });
      res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
      return;
    }
    next();
  };
};

export const requireAuth = verifyToken;

export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;
    
    const role = (decodedToken.role as string) || 'customer';

    req.user = {
      uid,
      email: decodedToken.email,
      role
    };
    next();
  } catch (error) {
    // If token invalid, proceed as guest
    next();
  }
};
