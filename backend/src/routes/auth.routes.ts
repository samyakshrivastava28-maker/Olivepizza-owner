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


import { verifyToken, requireRole, AuthRequest, logSecurityEventServer } from '../middleware/auth.middleware.js';
import { FranchiseScopeService } from '../services/franchise/FranchiseScopeService.js';
import { TOTPService } from '../services/auth/TOTPService.js';
import { adminDb, adminAuth } from '../config/firebase.js';
import { EmailVerificationService } from '../services/auth/EmailVerificationService.js';
import { LoginRateLimiterService } from '../services/auth/LoginRateLimiterService.js';
import { PosAccountService } from '../services/auth/PosAccountService.js';
import { PosPinService } from '../services/auth/PosPinService.js';
import { PasswordResetWorkflowService } from '../services/auth/PasswordResetWorkflowService.js';
import { AuthAuditService } from '../services/auth/AuthAuditService.js';

// ============================================================================
// AUTHORIZE OPERATIONAL APP HANDSHAKE (POS, RESTAURANT_MANAGER, FRANCHISE_MANAGER, DELIVERY)
// Enforces strict Owner-Controlled Allowlist across all 4 operational apps
// ============================================================================
router.post('/authorize-app', verifyToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !user.uid) {
      res.status(401).json({ authorized: false, reason: 'Authentication required' });
      return;
    }

    const { targetApp, terminalId, requestedBranchId } = req.body;
    const validApps = ['POS', 'RESTAURANT_MANAGER', 'FRANCHISE_MANAGER', 'DELIVERY', 'OWNER', 'CUSTOMER'];
    if (!targetApp || !validApps.includes(targetApp)) {
      res.status(400).json({ authorized: false, reason: `Invalid targetApp. Must be one of: ${validApps.join(', ')}` });
      return;
    }

    const rawDeviceId = (req.headers['x-device-id'] || req.headers['x-installation-id'] || req.body?.deviceId || req.body?.device_id || '') as string;
    const userAgent = (req.headers['user-agent'] || '') as string;
    const userIdentifier = (user.email || user.uid || '').toLowerCase().trim();
    const clientIp = (req.ip || (req.headers['x-forwarded-for'] as string)?.split(',')[0] || '127.0.0.1').trim();

    // ── 1. Server-Enforced Login Rate Limiter (Max 2 attempts per 15 min per device, 3rd blocked for operational staff) ──
    if (targetApp !== 'CUSTOMER') {
      const rateStatus = await LoginRateLimiterService.consumeAttempt(rawDeviceId, clientIp, userAgent, userIdentifier, targetApp);
      if (!rateStatus.allowed) {
        res.setHeader('Retry-After', String(rateStatus.retryAfterSeconds));
        res.status(429).json({
          success: false,
          authorized: false,
          code: 'AUTH_RATE_LIMITED',
          message: rateStatus.message || 'Too many login attempts from this device. Please try again later.',
          reason: rateStatus.message || 'Too many login attempts from this device. Please try again later.',
          retryAfter: rateStatus.retryAfterSeconds,
          retryAfterSeconds: rateStatus.retryAfterSeconds
        });
        return;
      }
    }

    const emailLower = (user.email || '').toLowerCase().trim();
    const isMasterOwner = emailLower === 'olivepizzarjn@gmail.com' ||
      emailLower === 'webhub2811@gmail.com' ||
      emailLower === 'olivepizzamaker@gmail.com';
    const isOwnerRole = isMasterOwner || user.role === 'owner' || user.role === 'platform_owner';

    // ── 2. Owner Operational Privacy & Boundary Enforcement ──
    // Owner accounts are strictly forbidden from operational POS, Restaurant Management, and Delivery access
    if (isOwnerRole) {
      if (targetApp === 'POS') {
        await LoginRateLimiterService.recordAttempt(userIdentifier, clientIp);
        await AuthAuditService.logEvent({
          eventType: 'APP_AUTHORIZE_DENIED',
          userId: user.uid,
          identifier: user.email,
          appTarget: targetApp,
          status: 'BLOCKED',
          metadata: { reason: 'OWNER_RESTRICTED_FROM_POS' }
        });
        res.status(403).json({
          authorized: false,
          app: targetApp,
          email: user.email,
          reason: 'Owner accounts are restricted from POS operational access to preserve store-level separation of duties and owner privacy.'
        });
        return;
      }

      if (targetApp === 'RESTAURANT_MANAGER') {
        await LoginRateLimiterService.recordAttempt(userIdentifier, clientIp);
        await AuthAuditService.logEvent({
          eventType: 'APP_AUTHORIZE_DENIED',
          userId: user.uid,
          identifier: user.email,
          appTarget: targetApp,
          status: 'BLOCKED',
          metadata: { reason: 'OWNER_RESTRICTED_FROM_RESTAURANT_MANAGER' }
        });
        res.status(403).json({
          authorized: false,
          app: targetApp,
          email: user.email,
          reason: 'Owner accounts are restricted from operational restaurant management access to preserve operational boundaries and branch privacy.'
        });
        return;
      }

      if (targetApp === 'DELIVERY') {
        await LoginRateLimiterService.recordAttempt(userIdentifier, clientIp);
        await AuthAuditService.logEvent({
          eventType: 'APP_AUTHORIZE_DENIED',
          userId: user.uid,
          identifier: user.email,
          appTarget: targetApp,
          status: 'BLOCKED',
          metadata: { reason: 'OWNER_RESTRICTED_FROM_DELIVERY' }
        });
        res.status(403).json({
          authorized: false,
          app: targetApp,
          email: user.email,
          reason: 'Owner accounts are restricted from operational delivery rider access.'
        });
        return;
      }

      if (targetApp === 'CUSTOMER') {
        await LoginRateLimiterService.recordSuccess(userIdentifier, clientIp, rawDeviceId);
        res.json({
          authorized: true,
          app: targetApp,
          user: {
            uid: user.uid,
            email: user.email,
            name: (user as any).name || 'Owner',
            role: 'customer',
            isOwner: true
          }
        });
        return;
      }

      if (targetApp === 'FRANCHISE_MANAGER') {
        await LoginRateLimiterService.recordAttempt(userIdentifier, clientIp);
        await AuthAuditService.logEvent({
          eventType: 'APP_AUTHORIZE_DENIED',
          userId: user.uid,
          identifier: user.email,
          appTarget: targetApp,
          status: 'BLOCKED',
          metadata: { reason: 'OWNER_RESTRICTED_FROM_FRANCHISE_MANAGER' }
        });
        res.status(403).json({
          authorized: false,
          app: targetApp,
          email: user.email,
          reason: 'Owner accounts are restricted from operational Franchise Management application access. Owner must use the Owner Console.'
        });
        return;
      }

      if (targetApp !== 'OWNER') {
        await LoginRateLimiterService.recordAttempt(userIdentifier, clientIp);
        res.status(403).json({
          authorized: false,
          app: targetApp,
          email: user.email,
          reason: 'Owner accounts are restricted to the Owner Console only.'
        });
        return;
      }

      // Owner is authorized strictly for OWNER Console
      await LoginRateLimiterService.recordSuccess(userIdentifier, clientIp);
      await AuthAuditService.logEvent({
        eventType: 'APP_AUTHORIZE_SUCCESS',
        userId: user.uid,
        identifier: user.email,
        appTarget: targetApp,
        status: 'SUCCESS'
      });

      res.json({
        authorized: true,
        app: targetApp,
        user: {
          uid: user.uid,
          email: user.email,
          name: 'Platform Owner',
          role: 'owner',
          branchId: requestedBranchId || 'main_branch',
          branchName: 'Olive Pizza — Rajnandgaon HQ',
          franchiseId: 'fra_rajnandgaon',
          permissions: ['*'],
          allowedApps: ['OWNER'],
          applicationAccess: {
            app_franchise_management: false,
            app_restaurant_management: false,
            app_pos: false,
            app_delivery: false
          }
        }
      });
      return;
    }

    // ── 3. Fetch user document from Firestore ──
    let userData: any = null;
    const userDocSnap = await adminDb.collection('users').doc(user.uid).get();
    if (userDocSnap.exists) {
      userData = userDocSnap.data();
    } else if (emailLower) {
      const q = await adminDb.collection('users').where('email', '==', emailLower).limit(1).get();
      if (!q.empty) {
        userData = q.docs[0].data();
      }
    }

    // ── 4. Active status check ──
    if (userData && (userData.isActive === false || userData.isBlocked === true || userData.status === 'suspended' || userData.status === 'SUSPENDED' || userData.status === 'REVOKED' || userData.role === 'REVOKED')) {
      await LoginRateLimiterService.recordAttempt(userIdentifier, clientIp);
      await logSecurityEventServer({
        action: 'deactivated_account_access_attempt',
        route: '/api/auth/authorize-app',
        uid: user.uid,
        email: user.email,
        role: userData?.role || user.role,
        branchId: userData?.branchId || user.branchId,
        ip: req.ip
      });
      res.status(403).json({
        authorized: false,
        reason: 'This account has been deactivated or revoked by the owner.',
        app: targetApp,
        email: user.email
      });
      return;
    }

    let role = userData?.role || user.role || 'customer';
    let branchId = userData?.branchId || user.branchId || 'main_branch';
    let branchName = userData?.branchName || 'Olive Pizza — Rajnandgaon (HQ)';
    let franchiseId = userData?.franchiseId || user.franchiseId || 'fra_primary';
    let branchIds = userData?.branchIds || [branchId];
    let permissions = userData?.permissions || [];
    let allowedApps: string[] = Array.isArray(userData?.allowedApps) ? userData.allowedApps : [];
    let isAuthorized = false;
    let requiresPin = false;
    let isProfileComplete = true;
    let denialReason = 'This account is not authorized to use this Olive Pizza application.';

    // ── 5. App-specific permission verification & gates ──
    if (targetApp === 'POS') {
      // Rule: Allowed ONLY to Franchise Manager of that franchise OR the single Owner-approved POS account
      let isPosAuthorized = false;
      let franchiseIdResolved = franchiseId;

      // Check if user is a Franchise Manager
      const isFranchiseMgr = role === 'franchise_manager' || role === 'franchise_owner';
      let fraSnap = null;
      if (!isFranchiseMgr) {
        fraSnap = await adminDb.collection('franchise_users').doc(user.uid).get();
        if (!fraSnap.exists && emailLower) {
          const q = await adminDb.collection('franchise_users').where('email', '==', emailLower).limit(1).get();
          if (!q.empty) fraSnap = q.docs[0];
        }
      }

      if (isFranchiseMgr || (fraSnap && fraSnap.exists && fraSnap.data()?.isActive !== false)) {
        isPosAuthorized = true;
        role = 'franchise_manager';
        if (fraSnap?.exists) {
          franchiseIdResolved = fraSnap.data()?.franchiseId || franchiseIdResolved;
        }
      } else {
        // Check pos_accounts collection
        let posDoc = await adminDb.collection('pos_accounts').doc(user.uid).get();
        if (!posDoc.exists && emailLower) {
          const q = await adminDb.collection('pos_accounts').where('email', '==', emailLower).limit(1).get();
          if (!q.empty) posDoc = q.docs[0];
        }

        if (posDoc && posDoc.exists) {
          const posData = posDoc.data()!;
          if (posData.status === 'PENDING_OWNER_APPROVAL') {
            await LoginRateLimiterService.recordAttempt(userIdentifier, clientIp);
            res.status(403).json({
              authorized: false,
              code: 'PENDING_OWNER_APPROVAL',
              app: targetApp,
              reason: 'Your POS terminal account is pending Owner approval. You will be able to log in once your store owner verifies and approves your account.'
            });
            return;
          }

          if (posData.status === 'REJECTED') {
            await LoginRateLimiterService.recordAttempt(userIdentifier, clientIp);
            res.status(403).json({
              authorized: false,
              code: 'ACCOUNT_REJECTED',
              app: targetApp,
              reason: 'Your POS account was rejected by the store owner.'
            });
            return;
          }

          if (posData.status === 'REVOKED' || posData.isActive === false) {
            await LoginRateLimiterService.recordAttempt(userIdentifier, clientIp);
            res.status(403).json({
              authorized: false,
              code: 'ACCOUNT_REVOKED',
              app: targetApp,
              reason: 'Your POS account access has been revoked.'
            });
            return;
          }

          if (posData.status === 'APPROVED' || posData.status === 'ACTIVE') {
            isPosAuthorized = true;
            role = 'pos_operator';
            franchiseIdResolved = posData.franchiseId || franchiseIdResolved;
          }
        }
      }

      if (!isPosAuthorized) {
        await LoginRateLimiterService.recordAttempt(userIdentifier, clientIp);
        await AuthAuditService.logEvent({
          eventType: 'APP_AUTHORIZE_DENIED',
          userId: user.uid,
          identifier: user.email,
          appTarget: targetApp,
          status: 'BLOCKED',
          metadata: { reason: 'NOT_AUTHORIZED_FOR_POS' }
        });
        res.status(403).json({
          authorized: false,
          app: targetApp,
          email: user.email,
          reason: 'Access denied. Only the Franchise Manager and the authorized POS account are permitted to access POS.'
        });
        return;
      }

      // POS email verification check (if email-based authentication)
      if (user.email_verified === false && !user.phone_number) {
        res.status(403).json({
          authorized: false,
          code: 'EMAIL_NOT_VERIFIED',
          reason: 'Email verification required. Please verify your email before accessing POS.',
          app: targetApp
        });
        return;
      }

      isAuthorized = true;
      requiresPin = true;
      franchiseId = franchiseIdResolved;
    } else if (targetApp === 'RESTAURANT_MANAGER') {
      // 1. Check email verification (if not phone authenticated)
      if (user.email_verified === false && !user.phone_number) {
        res.status(403).json({
          authorized: false,
          code: 'EMAIL_NOT_VERIFIED',
          reason: 'Email verification required. Please verify your email before accessing Restaurant Management.',
          app: targetApp
        });
        return;
      }

      // 2. Fetch restaurant manager document
      let mgrDoc = await adminDb.collection('restaurant_managers').doc(user.uid).get();
      if (!mgrDoc.exists && emailLower) {
        const mgrSnap = await adminDb.collection('restaurant_managers').where('email', '==', emailLower).limit(1).get();
        if (!mgrSnap.empty) {
          mgrDoc = mgrSnap.docs[0];
        }
      }
      if (!mgrDoc.exists && user.phone_number) {
        const mgrSnap = await adminDb.collection('restaurant_managers').where('phone', '==', user.phone_number).limit(1).get();
        if (!mgrSnap.empty) {
          mgrDoc = mgrSnap.docs[0];
        }
      }

      if (mgrDoc.exists) {
        const mData = mgrDoc.data()!;
        if (mData.status === 'PENDING_OWNER_APPROVAL') {
          res.status(403).json({
            authorized: false,
            code: 'PENDING_OWNER_APPROVAL',
            reason: 'Your Restaurant Manager account is pending Owner approval. You will receive an email once approved.',
            app: targetApp
          });
          return;
        }

        if (mData.status === 'REJECTED' || mData.status === 'ACCOUNT_REJECTED') {
          res.status(403).json({
            authorized: false,
            code: 'ACCOUNT_REJECTED',
            reason: 'Your Restaurant Manager account request was rejected by the Owner.',
            app: targetApp
          });
          return;
        }

        if (mData.isActive === false || mData.status === 'DEACTIVATED' || mData.status === 'ACCOUNT_DEACTIVATED') {
          res.status(403).json({
            authorized: false,
            code: 'ACCOUNT_DEACTIVATED',
            reason: 'This Restaurant Manager account has been deactivated.',
            app: targetApp
          });
          return;
        }

        if (mData.status !== 'APPROVED') {
          res.status(403).json({
            authorized: false,
            code: 'INVALID_STATUS',
            reason: 'Restaurant Manager account status is invalid.',
            app: targetApp
          });
          return;
        }

        isAuthorized = true;
        requiresPin = true;
        role = 'restaurant_manager';
        branchId = mData.branchId || 'main_branch';
        branchName = mData.branchName || 'Olive Pizza — Rajnandgaon HQ';
        franchiseId = mData.franchiseId || 'fra_rajnandgaon';
        permissions = mData.permissions || [
          'dashboard.view',
          'orders.live',
          'orders.history',
          'notifications.send',
          'email.send',
          'delivery.view'
        ];
      } else {
        const hasExplicitGrant = allowedApps.includes('RESTAURANT_MANAGER') || 
          Boolean(userData?.applicationAccess?.app_restaurant_management);

        if (hasExplicitGrant) {
          isAuthorized = true;
          requiresPin = true;
          role = 'restaurant_manager';
          branchId = userData?.branchId || branchId;
          franchiseId = userData?.franchiseId || 'fra_rajnandgaon';
          permissions = permissions.length > 0 ? permissions : [
            'dashboard.view',
            'orders.live',
            'orders.history',
            'notifications.send',
            'email.send',
            'delivery.view'
          ];
        } else {
          res.status(403).json({
            authorized: false,
            code: 'NOT_REGISTERED',
            reason: 'No Restaurant Manager record found for this account. Please request provisioning through your Franchise Manager.',
            app: targetApp
          });
          return;
        }
      }
    } else if (targetApp === 'FRANCHISE_MANAGER') {
      const allowedRoles = ['owner', 'admin', 'developer', 'franchise_manager'];
      if (allowedRoles.includes(role) || allowedApps.includes('FRANCHISE_MANAGER')) {
        isAuthorized = true;
      } else {
        // Check franchise_users collection
        try {
          let fraDoc = await adminDb.collection('franchise_users').doc(user.uid).get();
          if (!fraDoc.exists && emailLower) {
            const fraSnap = await adminDb.collection('franchise_users').where('email', '==', emailLower).limit(1).get();
            if (!fraSnap.empty) {
              fraDoc = fraSnap.docs[0];
            }
          }
          if (fraDoc.exists && fraDoc.data()?.isActive !== false) {
            const fData = fraDoc.data()!;
            role = 'franchise_manager';
            franchiseId = fData.franchiseId || franchiseId;
            branchIds = fData.branchIds || branchIds;
            isAuthorized = true;
            adminDb.collection('users').doc(user.uid).set({ role, franchiseId, branchIds }, { merge: true }).catch(() => {});
          }
        } catch (fraErr) {
          console.warn('[AuthorizeApp] Franchise check notice:', fraErr);
        }
      }
    } else if (targetApp === 'DELIVERY') {
      // 1. Check email verification (if not phone authenticated)
      if (user.email_verified === false && !user.phone_number) {
        res.status(403).json({
          authorized: false,
          code: 'EMAIL_NOT_VERIFIED',
          reason: 'Email verification required. Please verify your email before accessing the Delivery app.',
          app: targetApp
        });
        return;
      }

      // 2. Check delivery_partners and delivery_riders collections
      let dpDoc = await adminDb.collection('delivery_partners').doc(user.uid).get();
      if (!dpDoc.exists) {
        dpDoc = await adminDb.collection('delivery_riders').doc(user.uid).get();
      }
      if (!dpDoc.exists && emailLower) {
        const dpSnap = await adminDb.collection('delivery_partners').where('email', '==', emailLower).limit(1).get();
        if (!dpSnap.empty) {
          dpDoc = dpSnap.docs[0];
        } else {
          const drSnap = await adminDb.collection('delivery_riders').where('email', '==', emailLower).limit(1).get();
          if (!drSnap.empty) {
            dpDoc = drSnap.docs[0];
          }
        }
      }
      if (!dpDoc.exists && user.phone_number) {
        const dpSnap = await adminDb.collection('delivery_partners').where('phone', '==', user.phone_number).limit(1).get();
        if (!dpSnap.empty) {
          dpDoc = dpSnap.docs[0];
        } else {
          const drSnap = await adminDb.collection('delivery_riders').where('phone', '==', user.phone_number).limit(1).get();
          if (!drSnap.empty) {
            dpDoc = drSnap.docs[0];
          }
        }
      }

      if (!dpDoc.exists) {
        const hasExplicitDeliveryGrant = allowedApps.includes('DELIVERY') || Boolean(userData?.applicationAccess?.app_delivery);
        if (!hasExplicitDeliveryGrant) {
          res.status(403).json({
            authorized: false,
            code: 'NOT_REGISTERED',
            reason: 'Your account is not registered as an authorized Olive Pizza delivery partner.',
            app: targetApp
          });
          return;
        }
      }

      const dData = dpDoc?.exists ? dpDoc.data()! : userData;
      if (dData.isActive === false || dData.status === 'INACTIVE' || dData.status === 'inactive' || dData.status === 'BLOCKED') {
        res.status(403).json({
          authorized: false,
          code: 'ACCOUNT_INACTIVE',
          reason: 'Your delivery rider account is inactive or suspended. Please contact management.',
          app: targetApp
        });
        return;
      }

      // Phone verification check
      if (dData.phoneVerified === false) {
        res.status(403).json({
          authorized: false,
          code: 'PHONE_NOT_VERIFIED',
          reason: 'Phone verification is required before signing in as a delivery partner.',
          app: targetApp
        });
        return;
      }

      const hasVerifiedPhone = Boolean(dData.phoneVerified || user.phone_number || (userData?.phone && userData?.phoneVerified));
      if (!hasVerifiedPhone && !dData.phone) {
        res.status(403).json({
          authorized: false,
          code: 'PHONE_NOT_VERIFIED',
          reason: 'Phone verification is required before signing in as a delivery partner.',
          app: targetApp
        });
        return;
      }

      isAuthorized = true;
      role = 'delivery_partner';
      branchId = dData.branchId || 'main_branch';
      franchiseId = dData.franchiseId || 'fra_rajnandgaon';
      isProfileComplete = Boolean(dData.name && dData.vehicleNumber);
    } else if (targetApp === 'OWNER') {
      // STRICT OWNER ENFORCEMENT: Only the verified platform owner email is permitted
      const isOwnerAccount = emailLower === 'olivepizzarjn@gmail.com' || emailLower === 'webhub2811@gmail.com';
      if (!isOwnerAccount) {
        await LoginRateLimiterService.recordAttempt(userIdentifier, clientIp);
        await AuthAuditService.logEvent({
          eventType: 'APP_AUTHORIZE_DENIED',
          userId: user.uid,
          identifier: user.email,
          appTarget: targetApp,
          status: 'BLOCKED',
          metadata: { reason: 'UNAUTHORIZED_OWNER_ATTEMPT' }
        });
        res.status(403).json({
          authorized: false,
          app: targetApp,
          email: user.email,
          reason: 'Access denied. Only the platform owner (olivepizzarjn@gmail.com) is authorized to access the Owner Console.'
        });
        return;
      }

      isAuthorized = true;
      role = 'owner';
    } else if (targetApp === 'CUSTOMER') {
      // All valid authenticated accounts are authorized to use the customer ordering application
      isAuthorized = true;
      role = 'customer';
    }

    if (!isAuthorized) {
      await LoginRateLimiterService.recordAttempt(userIdentifier, clientIp);
      await AuthAuditService.logEvent({
        eventType: 'APP_AUTHORIZE_DENIED',
        userId: user.uid,
        identifier: user.email,
        appTarget: targetApp,
        status: 'BLOCKED',
        metadata: { reason: denialReason }
      });

      await logSecurityEventServer({
        action: 'unauthorized_operational_app_attempt',
        route: '/api/auth/authorize-app',
        uid: user.uid,
        email: user.email,
        role,
        branchId,
        ip: req.ip
      });

      res.status(403).json({
        authorized: false,
        app: targetApp,
        email: user.email,
        reason: denialReason
      });
      return;
    }

    // Record success in rate limiter and audit log
    await LoginRateLimiterService.recordSuccess(userIdentifier, clientIp);
    await AuthAuditService.logEvent({
      eventType: 'APP_AUTHORIZE_SUCCESS',
      userId: user.uid,
      identifier: user.email,
      appTarget: targetApp,
      status: 'SUCCESS'
    });

    const resolvedAllowedApps = allowedApps.length > 0 ? allowedApps : (
      role === 'owner' || role === 'platform_owner'
        ? ['OWNER', 'FRANCHISE_MANAGER']
        : role === 'restaurant_manager'
        ? ['RESTAURANT_MANAGER']
        : role === 'franchise_manager' || role === 'franchise_owner'
        ? ['FRANCHISE_MANAGER']
        : role === 'delivery_partner'
        ? ['DELIVERY']
        : role === 'pos_operator' || role === 'cashier'
        ? ['POS']
        : ['CUSTOMER']
    );

    const resolvedAppAccess = userData?.applicationAccess || {
      app_franchise_management: resolvedAllowedApps.includes('FRANCHISE_MANAGER') || role === 'franchise_manager' || role === 'franchise_owner' || role === 'owner',
      app_restaurant_management: resolvedAllowedApps.includes('RESTAURANT_MANAGER') || role === 'restaurant_manager',
      app_pos: resolvedAllowedApps.includes('POS') || role === 'pos_operator' || role === 'cashier',
      app_delivery: resolvedAllowedApps.includes('DELIVERY') || role === 'delivery_partner'
    };

    res.json({
      authorized: true,
      app: targetApp,
      requiresPin,
      isProfileComplete,
      user: {
        uid: user.uid,
        email: user.email,
        name: userData?.name || user.email?.split('@')[0] || 'Staff Member',
        role,
        branchId,
        branchName,
        branchIds,
        franchiseId,
        terminalId: terminalId || userData?.terminalId || null,
        permissions,
        allowedApps: resolvedAllowedApps,
        applicationAccess: resolvedAppAccess
      }
    });
  } catch (error: any) {
    console.error('[AuthorizeApp] Error:', error);
    res.status(500).json({ authorized: false, reason: error.message || 'Authorization check failed' });
  }
});

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

    const { targetFranchiseId, targetBranchId, targetBranchName } = req.body;
    const requestedTarget = (req.body.targetApp || req.body.context || '').toLowerCase();

    if (
      requestedTarget === 'restaurant_management' ||
      requestedTarget === 'delivery' ||
      requestedTarget === 'customer' ||
      requestedTarget === 'restaurant_manager' ||
      requestedTarget === 'delivery_rider' ||
      requestedTarget === 'delivery_partner'
    ) {
      res.status(403).json({ error: 'Forbidden: Owner accounts cannot generate operational impersonation sessions for Restaurant Management or Delivery.' });
      return;
    }

    const targetApp = req.body.targetApp || req.body.context || 'franchise_management';

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

    const franchiseBaseUrl = process.env.FRANCHISE_URL || 'https://franchise.olivepizza.in';
    const managerBaseUrl = process.env.MANAGER_URL || 'https://manager.olivepizza.in';

    let targetUrl = managerBaseUrl;
    if (targetApp === 'franchise') {
      targetUrl = `${franchiseBaseUrl}?context=${sessionKey}&franchiseId=${encodeURIComponent(tokenPayload.targetFranchiseId)}`;
    } else {
      targetUrl = `${managerBaseUrl}?context=${sessionKey}&branchId=${encodeURIComponent(tokenPayload.targetBranchId)}&branchName=${encodeURIComponent(tokenPayload.targetBranchName)}`;
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

// ============================================================================
// UNIVERSAL 4-DIGIT EMAIL VERIFICATION (5-MIN EXPIRY, SHA-256 HASH AT REST)
// ============================================================================

// POST /api/auth/email/send-code
router.post('/email/send-code', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ success: false, message: 'Email address is required' });
      return;
    }
    const clientIp = (req.ip || (req.headers['x-forwarded-for'] as string)?.split(',')[0] || '127.0.0.1').trim();
    const result = await EmailVerificationService.sendVerificationCode(email, clientIp);

    if (!result.success) {
      const status = result.retryAfterSeconds ? 429 : 400;
      res.status(status).json(result);
      return;
    }

    res.json(result);
  } catch (err: any) {
    console.error('[AuthRoutes] Error sending verification code:', err);
    res.status(500).json({ success: false, message: 'Failed to dispatch verification code' });
  }
});

// POST /api/auth/email/verify-code
router.post('/email/verify-code', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      res.status(400).json({ success: false, message: 'Email and 4-digit verification code are required' });
      return;
    }
    const clientIp = (req.ip || (req.headers['x-forwarded-for'] as string)?.split(',')[0] || '127.0.0.1').trim();
    const result = await EmailVerificationService.verifyCode(email, code, clientIp);

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json(result);
  } catch (err: any) {
    console.error('[AuthRoutes] Error verifying code:', err);
    res.status(500).json({ success: false, message: 'Failed to verify code' });
  }
});

// POST /api/auth/email/signin - Customer sign in & token issuance with verified 4-digit code
router.post('/email/signin', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, code, name } = req.body;
    if (!email || !code) {
      res.status(400).json({ success: false, message: 'Email and 4-digit verification code are required' });
      return;
    }
    const cleanEmail = email.toLowerCase().trim();
    const clientIp = (req.ip || (req.headers['x-forwarded-for'] as string)?.split(',')[0] || '127.0.0.1').trim();

    // 1. Verify 4-digit OTP
    const verifyResult = await EmailVerificationService.verifyCode(cleanEmail, String(code).trim(), clientIp);
    if (!verifyResult.success) {
      res.status(400).json(verifyResult);
      return;
    }

    // 2. Resolve or create Firebase Auth user
    let uid: string | null = null;
    let isNewUser = false;
    let userData: any = null;

    try {
      const userRecord = await adminAuth.getUserByEmail(cleanEmail);
      uid = userRecord.uid;
    } catch (authErr: any) {
      if (authErr.code === 'auth/user-not-found') {
        const newUser = await adminAuth.createUser({
          email: cleanEmail,
          emailVerified: true,
          displayName: name || cleanEmail.split('@')[0],
        });
        uid = newUser.uid;
        isNewUser = true;
      } else {
        console.error('[AuthRoutes] Firebase getUserByEmail error:', authErr);
        throw authErr;
      }
    }

    // 3. Set custom user claims for role
    await adminAuth.setCustomUserClaims(uid, { role: 'customer' }).catch((e) => {
      console.warn('[AuthRoutes] Failed setting custom claims:', e.message);
    });

    // 4. Resolve or create Firestore users document
    const userRef = adminDb.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      userData = userDoc.data();
      await userRef.set({
        email: cleanEmail,
        emailVerified: true,
        lastLoginAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } else {
      isNewUser = true;
      userData = {
        firebase_uid: uid,
        email: cleanEmail,
        emailVerified: true,
        role: 'customer',
        name: name || cleanEmail.split('@')[0] || 'Customer',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        verificationMethod: 'email_otp',
      };
      await userRef.set(userData);
    }

    // 5. Generate custom token for client-side Firebase Auth sign-in
    const customToken = await adminAuth.createCustomToken(uid, { role: 'customer' });

    res.json({
      success: true,
      customToken,
      user: {
        uid,
        email: cleanEmail,
        name: userData?.name || name || cleanEmail.split('@')[0],
        phone: userData?.phone || null,
        phoneVerified: Boolean(userData?.phoneVerified),
        role: 'customer',
      },
      isNewUser,
    });
  } catch (err: any) {
    console.error('[AuthRoutes] Error in email signin:', err);
    res.status(500).json({ success: false, message: 'Failed to complete sign in. Please try again.' });
  }
});

// ============================================================================
// POS 4-DIGIT OPERATIONAL PIN MANAGEMENT & UNLOCK
// ============================================================================

// GET /api/auth/pos/pin/status - Check whether PIN is configured and lock status
router.get('/pos/pin/status', verifyToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    const status = await PosPinService.checkPinStatus(uid);
    res.json({ success: true, ...status });
  } catch (err: any) {
    console.error('[AuthRoutes] Error checking POS PIN status:', err);
    res.status(500).json({ success: false, message: 'Failed to query PIN status' });
  }
});

// POST /api/auth/pos/pin/setup - Setup 4-digit PIN for first-time POS user
router.post('/pos/pin/setup', verifyToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const uid = req.user?.uid;
    const { pin } = req.body;
    if (!uid) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    const result = await PosPinService.setupPin(uid, pin);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  } catch (err: any) {
    console.error('[AuthRoutes] Error setting POS PIN:', err);
    res.status(500).json({ success: false, message: 'Failed to configure PIN' });
  }
});

// POST /api/auth/pos/pin/verify - Verify 4-digit PIN on app unlock / restart
router.post('/pos/pin/verify', verifyToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const uid = req.user?.uid;
    const { pin } = req.body;
    if (!uid) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    const clientIp = (req.ip || (req.headers['x-forwarded-for'] as string)?.split(',')[0] || '127.0.0.1').trim();
    const result = await PosPinService.verifyPin(uid, pin, clientIp);

    if (!result.success) {
      const status = result.locked ? 423 : 400; // 423 Locked
      res.status(status).json(result);
      return;
    }

    res.json(result);
  } catch (err: any) {
    console.error('[AuthRoutes] Error verifying POS PIN:', err);
    res.status(500).json({ success: false, message: 'Failed to verify PIN' });
  }
});

// ============================================================================
// OWNER-CONTROLLED POS PASSWORD RESET WORKFLOW
// ============================================================================

// POST /api/auth/password-reset/request - POS operator submits reset request
router.post('/password-reset/request', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, appTarget = 'POS' } = req.body;
    if (!email) {
      res.status(400).json({ success: false, message: 'Email is required' });
      return;
    }
    const result = await PasswordResetWorkflowService.requestReset(email, appTarget);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  } catch (err: any) {
    console.error('[AuthRoutes] Error requesting password reset:', err);
    res.status(500).json({ success: false, message: 'Failed to submit password reset request' });
  }
});

// GET /api/auth/password-reset/pending - Owner lists pending reset requests
router.get('/password-reset/pending', verifyToken, requireRole(['owner', 'admin', 'developer', 'platform_owner']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const requests = await PasswordResetWorkflowService.listPendingRequests();
    res.json({ success: true, requests });
  } catch (err: any) {
    console.error('[AuthRoutes] Error listing pending reset requests:', err);
    res.status(500).json({ success: false, message: 'Failed to list reset requests' });
  }
});

// POST /api/auth/password-reset/send-email - Owner approves and triggers Firebase password reset email
router.post('/password-reset/send-email', verifyToken, requireRole(['owner', 'admin', 'developer', 'platform_owner']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { requestId } = req.body;
    if (!requestId) {
      res.status(400).json({ success: false, message: 'Request ID is required' });
      return;
    }
    const ownerEmail = req.user?.email || 'owner@olivepizza.in';
    const result = await PasswordResetWorkflowService.sendResetEmail(requestId, ownerEmail);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  } catch (err: any) {
    console.error('[AuthRoutes] Error sending reset email:', err);
    res.status(500).json({ success: false, message: 'Failed to send reset email' });
  }
});

// POST /api/auth/password-reset/reject - Owner rejects reset request
router.post('/password-reset/reject', verifyToken, requireRole(['owner', 'admin', 'developer', 'platform_owner']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { requestId, reason } = req.body;
    if (!requestId) {
      res.status(400).json({ success: false, message: 'Request ID is required' });
      return;
    }
    const ownerEmail = req.user?.email || 'owner@olivepizza.in';
    const result = await PasswordResetWorkflowService.rejectReset(requestId, ownerEmail, reason);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  } catch (err: any) {
    console.error('[AuthRoutes] Error rejecting reset request:', err);
    res.status(500).json({ success: false, message: 'Failed to reject reset request' });
  }
});

export default router;
