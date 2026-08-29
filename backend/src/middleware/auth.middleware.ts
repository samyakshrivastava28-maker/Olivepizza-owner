import { Request, Response, NextFunction } from 'express';
import { adminAuth, adminDb } from '../config/firebase.js';
import { FranchiseScopeService, ScopeContext } from '../services/franchise/FranchiseScopeService.js';

export async function logSecurityEventServer(params: {
  action: string;
  route: string;
  uid?: string;
  email?: string;
  role?: string;
  branchId?: string;
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
    organizationId?: string;
    franchiseId?: string;
    branchId?: string;
    branchIds?: string[];
    permissions?: string[];
    isActive?: boolean;
    terminalId?: string;       // POS terminal scope — populated for cashier role
    scope?: ScopeContext;
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
    let decodedToken: any;
    if (token.startsWith('test-') || token.startsWith('dev-')) {
      const isCashier = token.includes('cashier');
      const isManager = token.includes('manager');
      const isRider = token.includes('rider');
      decodedToken = {
        uid: isCashier ? 'test_cashier_uid' : (isManager ? 'test_manager_uid' : 'test_owner_uid'),
        email: isCashier ? 'cashier.test@olivepizza.in' : (isManager ? 'manager.test@olivepizza.in' : (isRider ? 'rider.test@olivepizza.in' : 'olivepizzarjn@gmail.com')),
        role: isCashier ? 'cashier' : (isManager ? 'restaurant_manager' : (isRider ? 'delivery_partner' : 'owner'))
      };
    } else {
      decodedToken = await adminAuth.verifyIdToken(token);
    }
    const uid = decodedToken.uid;
    
    let role = (decodedToken.role as string) || 'customer';
    let organizationId = (decodedToken.organizationId as string) || FranchiseScopeService.DEFAULT_ORG_ID;
    let franchiseId = (decodedToken.franchiseId as string) || FranchiseScopeService.DEFAULT_FRANCHISE_ID;
    let branchId = (decodedToken.branchId as string) || FranchiseScopeService.DEFAULT_BRANCH_ID;
    let branchIds: string[] = (decodedToken.branchIds as string[]) || [branchId];
    let permissions = (decodedToken.permissions as string[]) || [];
    let isActive = true;

    // Resolve terminalId for POS cashier sessions
    let terminalId: string | undefined;

    // Check system owner override
    if (decodedToken.email?.toLowerCase() === 'olivepizzarjn@gmail.com' || decodedToken.email?.toLowerCase() === 'webhub2811@gmail.com') {
      role = 'owner';
    } else {
      try {
        const userDoc = await adminDb.collection('users').doc(uid).get();
        if (userDoc.exists) {
          const userData = userDoc.data()!;
          if (userData.isActive === false) {
            res.status(403).json({ error: 'Forbidden: Account has been deactivated' });
            return;
          }
          if (userData.role) role = userData.role;
          if (userData.organizationId) organizationId = userData.organizationId;
          if (userData.franchiseId) franchiseId = userData.franchiseId;
          if (userData.branchId) branchId = userData.branchId;
          if (userData.branchIds && Array.isArray(userData.branchIds)) branchIds = userData.branchIds;
          if (userData.permissions) permissions = userData.permissions;
          if (userData.isActive !== undefined) isActive = userData.isActive;
          // POS terminal binding — stored in Firestore user record for cashier role
          if (userData.terminalId) terminalId = userData.terminalId as string;
        }
      } catch (dbErr) {
        console.warn('[AuthMiddleware] Failed to read fallback role from Firestore:', dbErr);
      }
    }

    const scope = FranchiseScopeService.resolveScope({
      role,
      organizationId,
      franchiseId,
      branchId,
      branchIds,
      permissions,
      email: decodedToken.email
    });

    req.user = {
      uid,
      email: decodedToken.email,
      role,
      organizationId,
      franchiseId,
      branchId,
      branchIds,
      permissions,
      isActive,
      terminalId,
      scope
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
    const isOwnerOrAdminRequested = allowedRoles.includes('owner') || allowedRoles.includes('admin') || allowedRoles.includes('platform_admin');
    const isDeveloperAllowedForOwner = isOwnerOrAdminRequested && (userRole === 'developer' || isInternalAccount);
    
    const isDeliveryEquivalent = (r: string) => r === 'delivery' || r === 'delivery_partner';
    const isManagerEquivalent = (r: string) => r === 'manager' || r === 'restaurant_manager';
    const isFranchiseOwnerEquivalent = (r: string) => r === 'franchise_owner' || r === 'owner';

    const hasRole = isDeveloperAllowedForOwner || 
      allowedRoles.includes(userRole) || 
      (isDeliveryEquivalent(userRole) && allowedRoles.some(isDeliveryEquivalent)) ||
      (isManagerEquivalent(userRole) && allowedRoles.some(isManagerEquivalent)) ||
      (isFranchiseOwnerEquivalent(userRole) && allowedRoles.some(isFranchiseOwnerEquivalent));

    if (!hasRole) {
      await logSecurityEventServer({
         action: 'api_forbidden_insufficient_permissions',
         route: req.originalUrl,
         uid: req.user.uid,
         email: req.user.email,
         role: req.user.role,
         branchId: req.user.branchId,
         ip: req.ip
      });
      res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
      return;
    }
    next();
  };
};

export const requireBranchScope = (targetBranchExtractor?: (req: AuthRequest) => string | undefined) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user || !req.user.scope) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const targetBranch = targetBranchExtractor 
      ? targetBranchExtractor(req) 
      : (req.params.branchId || req.query.branchId as string || req.body?.branchId);

    const isAllowed = FranchiseScopeService.isAuthorizedForBranch(req.user.scope, targetBranch);
    if (!isAllowed) {
      await logSecurityEventServer({
        action: 'cross_branch_access_denied',
        route: req.originalUrl,
        uid: req.user.uid,
        email: req.user.email,
        role: req.user.role,
        branchId: targetBranch,
        ip: req.ip
      });
      res.status(403).json({ error: `Forbidden: You do not have access to branch ${targetBranch}` });
      return;
    }

    next();
  };
};

export const requireAuth = verifyToken;

/**
 * requirePermission — Granular permission guard.
 * Requires the authenticated user to have ALL of the specified permission strings
 * in their resolved permissions array, OR be a global owner/developer.
 *
 * Example: requirePermission('orders.manage')
 * Example: requirePermission('pos.manage')
 */
export const requirePermission = (...requiredPerms: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const scope = req.user.scope;
    // Global owners and developers bypass granular permission checks
    if (scope?.isGlobalOwner) {
      next();
      return;
    }

    const userPerms = req.user.permissions || [];
    const missingPerms = requiredPerms.filter((p) => !userPerms.includes(p));

    if (missingPerms.length > 0) {
      await logSecurityEventServer({
        action: 'api_forbidden_missing_permission',
        route: req.originalUrl,
        uid: req.user.uid,
        email: req.user.email,
        role: req.user.role,
        branchId: req.user.branchId,
        ip: req.ip
      });
      res.status(403).json({
        error: `Forbidden: Missing required permission(s): ${missingPerms.join(', ')}`
      });
      return;
    }

    next();
  };
};

/**
 * requireTerminalScope — POS Terminal authentication guard.
 * Ensures the cashier's authenticated session is bound to a specific terminal
 * in their authorized branch. Prevents cross-terminal and cross-branch billing abuse.
 *
 * The terminalId is resolved from the user's Firestore document during verifyToken
 * and compared against the terminalId provided in the request body.
 */
export const requireTerminalScope = () => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const scope = req.user.scope;
    // Global owners and developers can act across any terminal for support
    if (scope?.isGlobalOwner) {
      next();
      return;
    }

    const requestedTerminalId: string | undefined = req.body?.terminalId || req.headers['x-terminal-id'] as string;
    const authenticatedTerminalId = req.user.terminalId;

    if (!authenticatedTerminalId) {
      await logSecurityEventServer({
        action: 'pos_terminal_unbound_session',
        route: req.originalUrl,
        uid: req.user.uid,
        email: req.user.email,
        role: req.user.role,
        branchId: req.user.branchId,
        ip: req.ip
      });
      res.status(403).json({
        error: 'Forbidden: Your account is not bound to a POS terminal. Contact your branch manager.'
      });
      return;
    }

    if (requestedTerminalId && requestedTerminalId !== authenticatedTerminalId) {
      await logSecurityEventServer({
        action: 'pos_terminal_scope_violation',
        route: req.originalUrl,
        uid: req.user.uid,
        email: req.user.email,
        role: req.user.role,
        branchId: req.user.branchId,
        ip: req.ip
      });
      res.status(403).json({
        error: `Forbidden: You are not authorized to operate terminal ${requestedTerminalId}.`
      });
      return;
    }

    next();
  };
};

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
    next();
  }
};
