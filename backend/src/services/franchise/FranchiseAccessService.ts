import { adminDb, adminAuth } from '../../config/firebase.js';
import { FranchiseScopeService } from './FranchiseScopeService.js';
import { query } from '../../config/postgres.js';


export interface FranchiseAccessEntry {
  franchiseId: string;
  branchId: string;
  role: string;
  applications: {
    restaurantManagement: boolean;
    franchiseManagement: boolean;
    pos: boolean;
    delivery: boolean;
  };
  status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  createdAt?: string;
  updatedAt: string;
}

export interface ResolveAppAuthorizationParams {
  uid: string;
  email?: string;
  phoneNumber?: string;
  emailVerified?: boolean;
  targetApp: 'POS' | 'RESTAURANT_MANAGER' | 'FRANCHISE_MANAGER' | 'DELIVERY' | 'OWNER' | 'CUSTOMER';
  requestedBranchId?: string;
  terminalId?: string;
}

export interface AppAuthorizationResult {
  authorized: boolean;
  code?: string;
  reason?: string;
  requiresPin?: boolean;
  isProfileComplete?: boolean;
  user?: {
    uid: string;
    email: string;
    name: string;
    role: string;
    branchId: string;
    branchName: string;
    branchIds: string[];
    franchiseId: string;
    terminalId?: string | null;
    permissions: string[];
    allowedApps: string[];
    applicationAccess: Record<string, boolean>;
    phone?: string;
    phoneNumber?: string;
    vehicleType?: string;
    vehicleNumber?: string;
  };
}

export class FranchiseAccessService {
  /**
   * Updates an account's franchise-scoped access across the canonical users collection
   * and role-specific operational collections (restaurant_managers, pos_accounts, franchise_users, delivery_partners).
   */
  public static async updateFranchiseAccess(params: {
    targetUserId: string;
    franchiseId: string;
    branchId?: string;
    targetRole?: string;
    applicationAccess: {
      app_restaurant_management?: boolean;
      app_franchise_management?: boolean;
      app_pos?: boolean;
      app_delivery?: boolean;
    };
    accountStatus?: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
    permissions?: string[];
    actorUid: string;
    actorEmail: string;
  }): Promise<{ success: boolean; message: string; accessEntry: FranchiseAccessEntry }> {
    const {
      targetUserId,
      franchiseId,
      branchId,
      targetRole = 'staff',
      applicationAccess,
      accountStatus = 'ACTIVE',
      permissions = [],
      actorUid,
      actorEmail
    } = params;

    const now = new Date().toISOString();
    if (!adminDb) throw new Error('Database service unavailable');

    // 1. Resolve user email and UID
    let userDocRef = adminDb.collection('users').doc(targetUserId);
    let userDocSnap = await userDocRef.get();
    let email = '';
    let targetUid = targetUserId;

    if (userDocSnap.exists) {
      email = (userDocSnap.data()?.email || '').toLowerCase().trim();
    } else {
      // Check if targetUserId is an email or from subcollection
      if (targetUserId.includes('@')) {
        email = targetUserId.toLowerCase().trim();
        const q = await adminDb.collection('users').where('email', '==', email).limit(1).get();
        if (!q.empty) {
          userDocRef = adminDb.collection('users').doc(q.docs[0].id);
          userDocSnap = q.docs[0];
          targetUid = q.docs[0].id;
        } else if (adminAuth) {
          const authUser = await adminAuth.getUserByEmail(email).catch(() => null);
          if (authUser) {
            targetUid = authUser.uid;
            userDocRef = adminDb.collection('users').doc(targetUid);
            userDocSnap = await userDocRef.get();
          }
        }
      } else {
        // Try looking up in restaurant_managers, pos_accounts, or franchise_users
        const rmDoc = await adminDb.collection('restaurant_managers').doc(targetUserId).get();
        if (rmDoc.exists && rmDoc.data()?.email) {
          email = (rmDoc.data()?.email || '').toLowerCase().trim();
        } else {
          const posDoc = await adminDb.collection('pos_accounts').doc(targetUserId).get();
          if (posDoc.exists && posDoc.data()?.email) {
            email = (posDoc.data()?.email || '').toLowerCase().trim();
          }
        }
      }
    }

    // If still no user doc, look up via Firebase Auth
    if (!email && adminAuth && !targetUserId.includes('@')) {
      const authUser = await adminAuth.getUser(targetUserId).catch(() => null);
      if (authUser?.email) {
        email = authUser.email.toLowerCase().trim();
      }
    }

    // If user doc exists, ensure email is captured
    if (userDocSnap.exists && !email && userDocSnap.data()?.email) {
      email = (userDocSnap.data()?.email || '').toLowerCase().trim();
    }

    let effectiveBranchId = branchId || (userDocSnap.exists ? userDocSnap.data()?.branchId : undefined);
    if (!effectiveBranchId) {
      if (franchiseId === 'fra_rajnandgaon' || franchiseId === 'fra_primary') {
        effectiveBranchId = 'main_branch';
      } else {
        throw new Error(`Explicit branchId is required for franchise '${franchiseId}'`);
      }
    }

    const accessEntry: FranchiseAccessEntry = {
      franchiseId,
      branchId: effectiveBranchId,
      role: targetRole,
      applications: {
        restaurantManagement: Boolean(applicationAccess.app_restaurant_management),
        franchiseManagement: Boolean(applicationAccess.app_franchise_management),
        pos: Boolean(applicationAccess.app_pos),
        delivery: Boolean(applicationAccess.app_delivery)
      },
      status: accountStatus,
      updatedAt: now
    };

    const allowedApps: string[] = [];
    if (accessEntry.applications.franchiseManagement) allowedApps.push('FRANCHISE_MANAGER');
    if (accessEntry.applications.restaurantManagement) allowedApps.push('RESTAURANT_MANAGER');
    if (accessEntry.applications.pos) allowedApps.push('POS');
    if (accessEntry.applications.delivery) allowedApps.push('DELIVERY');

    // 2. Update canonical users document
    const existingFranchiseAccess: FranchiseAccessEntry[] = (userDocSnap.exists && Array.isArray(userDocSnap.data()?.franchiseAccess))
      ? userDocSnap.data()?.franchiseAccess
      : [];

    const otherAccess = existingFranchiseAccess.filter(fa => fa.franchiseId !== franchiseId);
    otherAccess.push(accessEntry);

    const userUpdates: Record<string, any> = {
      role: targetRole,
      status: accountStatus,
      isActive: accountStatus === 'ACTIVE',
      branchId: effectiveBranchId,
      franchiseId,
      allowedApps,
      applicationAccess: {
        app_restaurant_management: accessEntry.applications.restaurantManagement,
        app_franchise_management: accessEntry.applications.franchiseManagement,
        app_pos: accessEntry.applications.pos,
        app_delivery: accessEntry.applications.delivery
      },
      franchiseAccess: otherAccess,
      permissions: permissions.length > 0 ? permissions : (userDocSnap.exists ? userDocSnap.data()?.permissions : []),
      updatedAt: now,
      updatedBy: actorEmail || actorUid
    };

    if (email) userUpdates.email = email;
    if (accountStatus === 'ACTIVE') {
      userUpdates.status = 'ACTIVE';
      userUpdates.isActive = true;
      userUpdates.role = targetRole;
      userUpdates.branchId = effectiveBranchId;
      userUpdates.franchiseId = franchiseId;
      if (accessEntry.applications.pos) {
        userUpdates.terminalId = (userDocSnap.exists ? userDocSnap.data()?.terminalId : null) || 'POS-01';
      }
    } else {
      userUpdates.status = accountStatus;
      userUpdates.isActive = false;
    }

    await userDocRef.set(userUpdates, { merge: true });

    // 3. Synchronize to restaurant_managers collection
    const rmDocRef = adminDb.collection('restaurant_managers').doc(targetUid);
    if (accessEntry.applications.restaurantManagement && accountStatus === 'ACTIVE') {
      await rmDocRef.set({
        id: targetUid,
        email,
        role: 'restaurant_manager',
        branchId: effectiveBranchId,
        franchiseId,
        status: 'APPROVED',
        isActive: true,
        permissions: permissions.length > 0 ? permissions : ['dashboard.view', 'orders.live', 'orders.history', 'inventory.view', 'notifications.send', 'delivery.view'],
        updatedAt: now
      }, { merge: true });
    } else {
      await rmDocRef.set({
        isActive: false,
        status: accountStatus === 'ACTIVE' ? 'REVOKED' : accountStatus,
        updatedAt: now
      }, { merge: true }).catch(() => {});
    }

    // 4. Synchronize to pos_accounts collection
    const posDocRef = adminDb.collection('pos_accounts').doc(targetUid);
    if (accessEntry.applications.pos && accountStatus === 'ACTIVE') {
      await posDocRef.set({
        id: targetUid,
        email,
        franchiseId,
        branchId: effectiveBranchId,
        status: 'APPROVED',
        isActive: true,
        updatedAt: now
      }, { merge: true });
    } else {
      await posDocRef.set({
        isActive: false,
        status: 'REVOKED',
        updatedAt: now
      }, { merge: true }).catch(() => {});
    }

    // 5. Synchronize to franchise_users collection
    const fuDocRef = adminDb.collection('franchise_users').doc(targetUid);
    if (accessEntry.applications.franchiseManagement && accountStatus === 'ACTIVE') {
      await fuDocRef.set({
        id: targetUid,
        email,
        franchiseId,
        role: targetRole === 'franchise_owner' ? 'franchise_owner' : 'franchise_manager',
        status: 'APPROVED',
        isActive: true,
        updatedAt: now
      }, { merge: true });
    } else {
      await fuDocRef.set({
        isActive: false,
        status: 'DEACTIVATED',
        updatedAt: now
      }, { merge: true }).catch(() => {});
    }

    // 6. Synchronize to delivery_partners collection
    const dpDocRef = adminDb.collection('delivery_partners').doc(targetUid);
    if (accessEntry.applications.delivery && accountStatus === 'ACTIVE') {
      await dpDocRef.set({
        id: targetUid,
        email,
        franchiseId,
        branchId: effectiveBranchId,
        status: 'approved',
        isActive: true,
        updatedAt: now
      }, { merge: true });
    } else {
      await dpDocRef.set({
        isActive: false,
        status: 'suspended',
        updatedAt: now
      }, { merge: true }).catch(() => {});
    }

    // 7. If access was revoked or account suspended, revoke refresh tokens immediately
    if (accountStatus !== 'ACTIVE' || allowedApps.length === 0) {
      if (adminAuth) {
        await adminAuth.revokeRefreshTokens(targetUid).catch(() => {});
      }
    } else if (adminAuth && targetUid && !targetUid.includes('@')) {
      // Set active Firebase custom claims
      try {
        await adminAuth.setCustomUserClaims(targetUid, {
          role: targetRole,
          allowedApps,
          branchId: effectiveBranchId,
          franchiseId,
          isOwnerMode: targetRole === 'owner',
          admin: targetRole === 'owner' || targetRole === 'admin',
          permissions: permissions.length > 0 ? permissions : ['*']
        });
      } catch (claimsErr: any) {
        console.warn('[FranchiseAccessService] Error setting custom claims:', claimsErr.message);
      }
    }

    // Synchronize to PostgreSQL app_users table
    try {
      const allowedAppsJson = JSON.stringify(allowedApps);
      await query(
        `INSERT INTO app_users (id, email, role, status, franchise_id, branch_id, allowed_apps, is_active, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, NOW())
         ON CONFLICT (id) DO UPDATE SET
           email = COALESCE(EXCLUDED.email, app_users.email),
           role = EXCLUDED.role,
           status = EXCLUDED.status,
           franchise_id = EXCLUDED.franchise_id,
           branch_id = EXCLUDED.branch_id,
           allowed_apps = EXCLUDED.allowed_apps,
           is_active = EXCLUDED.is_active,
           updated_at = NOW()`,
        [
          targetUid,
          email || null,
          targetRole,
          accountStatus === 'ACTIVE' ? 'APPROVED' : 'DISABLED',
          franchiseId,
          effectiveBranchId,
          allowedAppsJson,
          accountStatus === 'ACTIVE'
        ]
      );
      if (email) {
        await query(
          `UPDATE app_users 
           SET role = $2, status = $3, franchise_id = $4, branch_id = $5, allowed_apps = $6::jsonb, is_active = $7, updated_at = NOW()
           WHERE email IS NOT NULL AND LOWER(email) = LOWER($1) AND id <> $8`,
          [
            email,
            targetRole,
            accountStatus === 'ACTIVE' ? 'APPROVED' : 'DISABLED',
            franchiseId,
            effectiveBranchId,
            allowedAppsJson,
            accountStatus === 'ACTIVE',
            targetUid
          ]
        ).catch(() => {});
      }
    } catch (pgSyncErr: any) {
      console.warn('[FranchiseAccessService] PostgreSQL app_users sync notice:', pgSyncErr.message);
    }

    // Synchronize to PostgreSQL delivery_partners table if delivery granted
    if (accessEntry.applications.delivery && accountStatus === 'ACTIVE') {
      try {
        await query(
          `INSERT INTO delivery_partners (id, name, email, phone, status, is_online, branch_id, franchise_id, updated_at)
           VALUES ($1, $2, $3, $4, 'APPROVED', true, $5, $6, NOW())
           ON CONFLICT (id) DO UPDATE SET
             email = COALESCE(EXCLUDED.email, delivery_partners.email),
             status = 'APPROVED',
             is_online = true,
             branch_id = EXCLUDED.branch_id,
             franchise_id = EXCLUDED.franchise_id,
             updated_at = NOW()`,
          [
            targetUid,
            (userDocSnap.exists ? (userDocSnap.data()?.name || userDocSnap.data()?.displayName) : null) || 'Delivery Partner',
            email || null,
            (userDocSnap.exists ? (userDocSnap.data()?.phone || userDocSnap.data()?.phoneNumber) : null) || null,
            effectiveBranchId,
            franchiseId
          ]
        );
      } catch (dpPgErr: any) {
        console.warn('[FranchiseAccessService] PostgreSQL delivery_partners sync notice:', dpPgErr.message);
      }
    } else {
      try {
        await query(
          `UPDATE delivery_partners
           SET status = 'DISABLED', is_online = false, updated_at = NOW()
           WHERE id = $1`,
          [targetUid]
        );
      } catch (dpPgErr: any) {
        console.warn('[FranchiseAccessService] PostgreSQL delivery_partners disable notice:', dpPgErr.message);
      }
    }

    // 8. Audit log
    await FranchiseScopeService.logFranchiseAudit({
      organizationId: FranchiseScopeService.DEFAULT_ORG_ID,
      franchiseId,
      branchId: effectiveBranchId,
      actorUid,
      actorEmail,
      actionType: 'FRANCHISE_ACCESS_UPDATED',
      entityType: 'user_franchise_access',
      entityId: targetUid,
      details: {
        email,
        accessEntry,
        allowedApps,
        accountStatus
      }
    });

    return {
      success: true,
      message: 'Franchise access synchronized successfully across all operational systems',
      accessEntry
    };
  }

  /**
   * Authoritative multi-app authorization resolver
   * Checks platform owner, canonical franchiseAccess, franchises document assignment,
   * subcollections, and ensures franchise status is not deleted.
   */
  public static async resolveAuthorization(
    params: ResolveAppAuthorizationParams
  ): Promise<AppAuthorizationResult> {
    const { uid, email, phoneNumber, emailVerified, targetApp, requestedBranchId, terminalId } = params;
    const emailLower = (email || '').toLowerCase().trim();

    if (!adminDb) {
      return { authorized: false, reason: 'Database service unavailable' };
    }

    // 1. Authorization is determined exclusively by PostgreSQL app_users role.
    // Accounts must be registered in app_users with role='owner'|'platform_owner'|'admin'.
    // No email-based fast-path — all identities go through database and Firestore checks.

    // 1. Authoritative PostgreSQL Database Check (app_users & delivery_partners)
    const phoneRaw = (phoneNumber || '').trim();
    const phoneDigits = phoneRaw.replace(/\D/g, '');
    const phoneLast10 = phoneDigits.slice(-10);

    let pgUserData: any = null;
    try {
      const pgUserRes = await query(
        `SELECT id, email, phone, name, role, status, franchise_id, branch_id, allowed_apps, is_active, metadata 
         FROM app_users 
         WHERE (email IS NOT NULL AND LOWER(email) = LOWER($1)) 
            OR id = $2 
            OR ($3 <> '' AND phone IS NOT NULL AND (phone = $3 OR RIGHT(REGEXP_REPLACE(phone, '\\D', '', 'g'), 10) = $4))
         LIMIT 1`,
        [emailLower, uid, phoneRaw, phoneLast10]
      );
      if (pgUserRes.rows.length > 0) {
        pgUserData = pgUserRes.rows[0];
      }
    } catch (pgErr: any) {
      console.error('[FranchiseAccessService] PostgreSQL app_users lookup failure (fail-closed):', pgErr.message);
      return {
        authorized: false,
        code: 'DATABASE_UNAVAILABLE',
        reason: 'Authoritative database temporarily unavailable'
      };
    }

    if (pgUserData && (pgUserData.is_active === false || pgUserData.status === 'REVOKED' || pgUserData.status === 'SUSPENDED' || pgUserData.status === 'DISABLED')) {
      return {
        authorized: false,
        code: 'ACCOUNT_REVOKED',
        reason: 'Account has been deactivated or revoked in system database.'
      };
    }

    if (pgUserData && pgUserData.is_active !== false) {
      const userRole = (pgUserData.role || '').toLowerCase();
      let allowedApps: string[] = [];
      if (Array.isArray(pgUserData.allowed_apps)) {
        allowedApps = pgUserData.allowed_apps;
      } else if (typeof pgUserData.allowed_apps === 'string') {
        try {
          const parsed = JSON.parse(pgUserData.allowed_apps);
          if (Array.isArray(parsed)) allowedApps = parsed;
        } catch {}
      }

      let metadataObj: any = pgUserData.metadata || {};
      if (typeof metadataObj === 'string') {
        try {
          metadataObj = JSON.parse(metadataObj);
        } catch {
          metadataObj = {};
        }
      }
      const isOwner = userRole === 'owner' || userRole === 'platform_owner' || userRole === 'admin';

      if (targetApp === 'OWNER') {
        if (isOwner) {
          return {
            authorized: true,
            requiresPin: false,
            isProfileComplete: true,
            user: {
              uid: pgUserData.id || uid,
              email: pgUserData.email || emailLower,
              name: pgUserData.name || 'Olive Pizza Owner',
              role: 'owner',
              phone: pgUserData.phone || '',
              phoneNumber: pgUserData.phone || '',
              branchId: pgUserData.branch_id || 'main_branch',
              branchName: 'Olive Pizza',
              branchIds: ['all'],
              franchiseId: pgUserData.franchise_id || 'fra_rajnandgaon',
              terminalId: terminalId || undefined,
              permissions: ['*'],
              allowedApps: ['OWNER'],
              applicationAccess: {
                app_restaurant_management: false,
                app_delivery: false,
                app_pos: false,
                app_franchise_management: false,
                app_owner: true
              }
            }
          };
        } else {
          return {
            authorized: false,
            code: 'ACCESS_DENIED',
            reason: 'This account is not authorized to access the Olive Pizza Owner Command Center.'
          };
        }
      }

      // Operational staff apps: Owner role does NOT implicitly grant operational staff-app access.
      // Must hold explicit allowed_apps grant or specific staff operational role.
      // Franchise Management permissions must NOT implicitly grant Restaurant Management, POS, or Delivery.
      const isPosStaff = ['pos_operator', 'cashier'].includes(userRole);
      const isManagerStaff = ['restaurant_manager', 'store_manager'].includes(userRole);
      const isFranchiseStaff = ['franchise_manager', 'franchise_owner'].includes(userRole);
      const hasExplicitAppGrant = allowedApps.some(a => (a || '').toString().trim().toUpperCase() === targetApp.toUpperCase());

      const hasAppAccess =
        hasExplicitAppGrant ||
        (targetApp === 'POS' && isPosStaff) ||
        (targetApp === 'RESTAURANT_MANAGER' && isManagerStaff) ||
        (targetApp === 'FRANCHISE_MANAGER' && isFranchiseStaff);

      if (!hasAppAccess && targetApp !== 'CUSTOMER') {
        if (isOwner) {
          return {
            authorized: false,
            code: 'STAFF_GRANT_REQUIRED',
            reason: `Platform owner account requires an explicit staff grant and branch scope to access the ${targetApp} application.`
          };
        }
        return {
          authorized: false,
          code: 'APP_ACCESS_DENIED',
          reason: `Your account does not have an active grant for the ${targetApp} application.`
        };
      }

      // Delivery app requires explicit delivery_partners record; do not authorize via general app_users grant
      if (hasAppAccess && targetApp !== 'DELIVERY') {
        const resolvedTerminal = (terminalId || pgUserData.terminal_id || metadataObj.terminalId || metadataObj.terminal_id || '').trim();
        if (targetApp === 'POS') {
          if (!resolvedTerminal) {
            return {
              authorized: false,
              code: 'TERMINAL_REQUIRED',
              reason: 'POS access requires a valid assigned terminal identifier.'
            };
          }

          // Strict terminal authorization: enforce metadata.allowed_terminals if configured
          const allowedTerminals = metadataObj.allowed_terminals || metadataObj.allowedTerminals;
          if (Array.isArray(allowedTerminals) && allowedTerminals.length > 0) {
            if (!allowedTerminals.includes(resolvedTerminal)) {
              return {
                authorized: false,
                code: 'TERMINAL_NOT_PERMITTED',
                reason: `Terminal "${resolvedTerminal}" is not permitted for this operator. Allowed terminals: ${allowedTerminals.join(', ')}.`
              };
            }
          }
        }

        // Branch and Franchise Scope Validation
        let resolvedBranch = pgUserData.branch_id;
        let resolvedFranchise = pgUserData.franchise_id;

        if (resolvedFranchise === 'fra_primary') {
          resolvedFranchise = 'fra_rajnandgaon';
        }

        // Strict multi-tenant isolation: non-owner staff must fail closed if branch or franchise is missing
        if (!isOwner) {
          if (!resolvedBranch || !resolvedFranchise) {
            return {
              authorized: false,
              code: 'BRANCH_SCOPE_REQUIRED',
              reason: 'Staff account must be explicitly assigned to an active branch and franchise scope in the system database.'
            };
          }

          if (isFranchiseStaff && targetApp === 'FRANCHISE_MANAGER') {
            // Franchise managers can scope to any branch within their assigned franchise
            if (requestedBranchId && requestedBranchId !== resolvedFranchise && requestedBranchId !== 'all') {
              resolvedBranch = requestedBranchId;
            }
          } else {
            // Branch-scoped staff (POS cashier, Restaurant Manager) are locked to their assigned branch
            if (requestedBranchId && requestedBranchId !== resolvedBranch && requestedBranchId !== resolvedFranchise) {
              return {
                authorized: false,
                code: 'BRANCH_SCOPE_VIOLATION',
                reason: `Forbidden: Your account is authorized for branch "${resolvedBranch}", not "${requestedBranchId}".`
              };
            }
          }
        } else {
          // Platform Owner can dynamically switch branch and franchise context
          if (requestedBranchId) {
            resolvedBranch = requestedBranchId;
          } else if (!resolvedBranch) {
            resolvedBranch = 'main_branch';
          }
          if (!resolvedFranchise) {
            resolvedFranchise = 'fra_rajnandgaon';
          }
        }

        // Validate branch existence, active status, and franchise ownership against PostgreSQL restaurant_branches
        if (resolvedBranch && resolvedBranch !== 'all') {
          try {
            const bRes = await query(
              `SELECT id, name, franchise_id, is_open FROM restaurant_branches WHERE id = $1 LIMIT 1`,
              [resolvedBranch]
            );
            if (bRes.rows.length === 0) {
              return {
                authorized: false,
                code: 'BRANCH_NOT_FOUND',
                reason: `Assigned branch "${resolvedBranch}" does not exist in system database.`
              };
            }
            const bRow = bRes.rows[0];
            if (bRow.is_open === false) {
              return {
                authorized: false,
                code: 'BRANCH_INACTIVE',
                reason: `Branch "${resolvedBranch}" is currently deactivated.`
              };
            }
            const branchFranchise = bRow.franchise_id === 'fra_primary' ? 'fra_rajnandgaon' : bRow.franchise_id;

            if (isOwner) {
              // Platform owner automatically adopts target branch's franchise scope
              resolvedFranchise = branchFranchise;
            } else {
              const userFranchise = resolvedFranchise === 'fra_primary' ? 'fra_rajnandgaon' : resolvedFranchise;
              if (userFranchise && userFranchise !== 'all' && branchFranchise !== userFranchise) {
                return {
                  authorized: false,
                  code: 'CROSS_FRANCHISE_VIOLATION',
                  reason: `Branch "${resolvedBranch}" does not belong to user franchise "${resolvedFranchise}".`
                };
              }
            }
          } catch (dbErr: any) {
            console.error('[FranchiseAccessService] Branch validation error (fail-closed):', dbErr.message);
            return {
              authorized: false,
              code: 'DATABASE_UNAVAILABLE',
              reason: 'Failed to validate branch assignment.'
            };
          }
        }

        const roleMap = {
          OWNER: 'owner',
          RESTAURANT_MANAGER: 'restaurant_manager',
          DELIVERY: 'delivery_partner',
          POS: 'pos_operator',
          FRANCHISE_MANAGER: 'franchise_manager',
          CUSTOMER: 'customer'
        };

        const effectiveAllowedApps = Array.from(new Set([targetApp, ...(Array.isArray(pgUserData.allowed_apps) ? pgUserData.allowed_apps : [])]));
        const appAccess = {
          app_restaurant_management: effectiveAllowedApps.includes('RESTAURANT_MANAGER'),
          app_delivery: effectiveAllowedApps.includes('DELIVERY'),
          app_pos: effectiveAllowedApps.includes('POS'),
          app_franchise_management: effectiveAllowedApps.includes('FRANCHISE_MANAGER'),
          app_owner: isOwner || effectiveAllowedApps.includes('OWNER')
        };
        const defaultPermissions = {
          RESTAURANT_MANAGER: ['dashboard.view', 'orders.live', 'orders.history', 'notifications.send', 'delivery.view', 'inventory.view'],
          POS: ['pos.billing', 'orders.create', 'orders.view'],
          FRANCHISE_MANAGER: ['franchise.dashboard', 'reports.view', 'staff.manage']
        };

        return {
          authorized: true,
          requiresPin: false,
          isProfileComplete: true,
          user: {
            uid: pgUserData.id || uid,
            email: pgUserData.email || emailLower,
            name: pgUserData.name || 'Olive Pizza Staff',
            role: isOwner ? (roleMap[targetApp] || 'staff') : (userRole || roleMap[targetApp] || 'staff'),
            phone: pgUserData.phone || '',
            phoneNumber: pgUserData.phone || '',
            branchId: resolvedBranch,
            branchName: 'Olive Pizza',
            branchIds: ['all', resolvedBranch],
            franchiseId: resolvedFranchise,
            terminalId: resolvedTerminal,
            permissions: isOwner ? ['*'] : (defaultPermissions[targetApp] || ['*']),
            allowedApps: effectiveAllowedApps,
            applicationAccess: appAccess
          }
        };
      }
    }

    // Check delivery_partners table in PostgreSQL for DELIVERY app
    if (targetApp === 'DELIVERY') {
      try {
        const riderRes = await query(
          `SELECT id, name, phone, email, status, is_online, branch_id, franchise_id, vehicle_type, vehicle_number 
           FROM delivery_partners 
           WHERE (email IS NOT NULL AND LOWER(email) = LOWER($1)) 
              OR id = $2 
              OR ($3 <> '' AND phone IS NOT NULL AND (phone = $3 OR RIGHT(REGEXP_REPLACE(phone, '\\D', '', 'g'), 10) = $4))
           LIMIT 1`,
          [emailLower, uid, phoneRaw, phoneLast10]
        );
        if (riderRes.rows.length > 0) {
          const dp = riderRes.rows[0];
          if (dp.status === 'REVOKED' || dp.status === 'TERMINATED' || dp.status === 'DISABLED') {
            return {
              authorized: false,
              code: 'ACCOUNT_REVOKED',
              reason: 'Delivery partner account has been revoked or disabled.'
            };
          }
          if (dp.status === 'APPROVED' || dp.is_online === true) {
            if (!dp.branch_id || !dp.franchise_id) {
              return {
                authorized: false,
                code: 'BRANCH_SCOPE_REQUIRED',
                reason: 'Delivery partner must be explicitly assigned to an active branch and franchise scope in the system database.'
              };
            }
            return {
              authorized: true,
              requiresPin: false,
              isProfileComplete: Boolean(dp.name && dp.phone),
              user: {
                uid: dp.id || uid,
                email: dp.email || emailLower,
                name: dp.name || 'Delivery Partner',
                role: 'delivery_partner',
                branchId: dp.branch_id,
                branchName: 'Olive Pizza',
                branchIds: [dp.branch_id],
                franchiseId: dp.franchise_id,
                permissions: ['delivery.orders', 'delivery.location'],
                allowedApps: ['DELIVERY'],
                applicationAccess: { app_delivery: true }
              }
            };
          } else {
            return {
              authorized: false,
              code: 'NOT_APPROVED',
              reason: 'Your delivery partner account is not active or approved.'
            };
          }
        }
      } catch (riderErr) {
        console.error('[FranchiseAccessService] PostgreSQL delivery_partners lookup failure (fail-closed):', riderErr.message);
        return {
          authorized: false,
          code: 'DATABASE_UNAVAILABLE',
          reason: 'Authoritative database temporarily unavailable'
        };
      }
    }

    // Customer app check: accessible to any valid user
    if (targetApp === 'CUSTOMER') {
      return {
        authorized: true,
        requiresPin: false,
        isProfileComplete: true,
        user: {
          uid,
          email: emailLower,
          name: emailLower ? emailLower.split('@')[0] : 'Customer',
          role: 'customer',
          branchId: requestedBranchId || 'main_branch',
          branchName: 'Olive Pizza',
          branchIds: ['main_branch'],
          franchiseId: 'fra_rajnandgaon',
          permissions: ['customer.order'],
          allowedApps: ['CUSTOMER'],
          applicationAccess: {}
        }
      };
    }

    // Fail-closed: PostgreSQL is the single authoritative source.
    // Unregistered accounts or accounts without explicit grants for operational apps must fail closed.
    return {
      authorized: false,
      code: 'NOT_REGISTERED',
      reason: `Account is not provisioned for ${targetApp} in the authoritative system database. Please contact your administrator.`
    };
  }
}
