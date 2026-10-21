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

    // 0. Master Owner Instant Authorization across all applications
    const isMasterOwner =
      emailLower === 'webhub2811@gmail.com' ||
      emailLower === 'olivepizzarjn@gmail.com' ||
      emailLower === 'olivepizzamaker@gmail.com';

    if (isMasterOwner) {
      const defaultBranch = requestedBranchId || 'main_branch';
      const defaultFranchise = 'fra_rajnandgaon';
      return {
        authorized: true,
        requiresPin: false,
        isProfileComplete: true,
        user: {
          uid,
          email: emailLower,
          name: 'Olive Pizza Owner',
          role: 'owner',
          phone: '+919179944445',
          phoneNumber: '+919179944445',
          branchId: defaultBranch,
          branchName: 'Olive Pizza — Rajnandgaon HQ',
          branchIds: ['all', defaultBranch],
          franchiseId: defaultFranchise,
          terminalId: terminalId || 'Counter 1',
          permissions: ['*'],
          allowedApps: ['OWNER', 'RESTAURANT_MANAGER', 'DELIVERY', 'POS', 'FRANCHISE_MANAGER', 'CUSTOMER'],
          applicationAccess: {
            app_restaurant_management: true,
            app_delivery: true,
            app_pos: true,
            app_franchise_management: true,
            app_owner: true
          }
        }
      };
    }

    // 1. Authoritative PostgreSQL Database Check (app_users & delivery_partners)
    let pgUserData: any = null;
    try {
      const pgUserRes = await query(
        `SELECT id, email, phone, name, role, status, franchise_id, branch_id, allowed_apps, is_active 
         FROM app_users 
         WHERE (email IS NOT NULL AND LOWER(email) = $1) OR id = $2 
         LIMIT 1`,
        [emailLower, uid]
      );
      if (pgUserRes.rows.length > 0) {
        pgUserData = pgUserRes.rows[0];
      }
    } catch (pgErr: any) {
      console.warn('[FranchiseAccessService] PostgreSQL app_users lookup notice:', pgErr.message);
    }

    if (pgUserData && pgUserData.is_active !== false) {
      const userRole = (pgUserData.role || '').toLowerCase();
      const allowedApps: string[] = Array.isArray(pgUserData.allowed_apps) ? pgUserData.allowed_apps : [];
      const isOwner = userRole === 'owner' || userRole === 'platform_owner';
      const isPosStaff = ['owner', 'platform_owner', 'admin', 'restaurant_manager', 'manager', 'store_manager', 'pos_operator', 'cashier', 'counter_staff', 'staff', 'franchise_manager', 'franchise_owner'].includes(userRole);
      const isManagerStaff = ['owner', 'platform_owner', 'admin', 'restaurant_manager', 'manager', 'store_manager', 'franchise_manager'].includes(userRole);
      const isFranchiseStaff = ['owner', 'platform_owner', 'admin', 'franchise_manager', 'franchise_owner'].includes(userRole);
      const isDeliveryStaff = ['delivery_partner', 'delivery', 'rider', 'owner', 'platform_owner'].includes(userRole);
      const hasAppAccess = isOwner || 
        allowedApps.some(a => (a || '').toString().trim().toUpperCase() === targetApp.toUpperCase()) ||
        (targetApp === 'POS' && isPosStaff) ||
        (targetApp === 'RESTAURANT_MANAGER' && isManagerStaff) ||
        (targetApp === 'FRANCHISE_MANAGER' && isFranchiseStaff) ||
        (targetApp === 'DELIVERY' && isDeliveryStaff);

      if (hasAppAccess) {
        let resolvedBranch = requestedBranchId || pgUserData.branch_id;
        let resolvedFranchise = pgUserData.franchise_id;
        if (resolvedFranchise === 'fra_primary' || resolvedFranchise === 'fra_rajnandgaon') {
          resolvedFranchise = 'fra_rajnandgaon';
        }
        if (!resolvedBranch) {
          try {
            const bRes = await query(`SELECT id, franchise_id FROM restaurant_branches WHERE is_active = true ORDER BY created_at ASC LIMIT 1`);
            if (bRes.rows.length > 0) {
              resolvedBranch = bRes.rows[0].id;
              resolvedFranchise = resolvedFranchise || bRes.rows[0].franchise_id;
            }
          } catch (_) {}
        }
        resolvedBranch = resolvedBranch || 'main_branch';
        resolvedFranchise = resolvedFranchise || 'fra_rajnandgaon';

        const roleMap: Record<string, string> = {
          OWNER: 'owner',
          RESTAURANT_MANAGER: 'restaurant_manager',
          DELIVERY: 'delivery_partner',
          POS: 'pos_operator',
          FRANCHISE_MANAGER: 'franchise_manager',
          CUSTOMER: 'customer'
        };

        return {
          authorized: true,
          requiresPin: false,
          isProfileComplete: true,
          user: {
            uid: pgUserData.id || uid,
            email: pgUserData.email || emailLower,
            name: pgUserData.name || 'Olive Pizza Staff',
            role: isOwner ? (roleMap[targetApp] || 'owner') : (userRole || roleMap[targetApp] || 'staff'),
            phone: pgUserData.phone || '+919179944445',
            phoneNumber: pgUserData.phone || '+919179944445',
            branchId: resolvedBranch,
            branchName: 'Olive Pizza — Rajnandgaon HQ',
            branchIds: ['all', resolvedBranch],
            franchiseId: resolvedFranchise,
            terminalId: terminalId || 'Counter 1',
            permissions: ['*'],
            allowedApps: isOwner ? ['OWNER', 'RESTAURANT_MANAGER', 'DELIVERY', 'POS', 'FRANCHISE_MANAGER', 'CUSTOMER'] : (allowedApps.includes('POS') ? allowedApps : [...allowedApps, 'POS']),
            applicationAccess: {
              app_restaurant_management: true,
              app_delivery: true,
              app_pos: true,
              app_franchise_management: true,
              app_owner: isOwner
            }
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
           WHERE (email IS NOT NULL AND LOWER(email) = $1) OR id = $2 
           LIMIT 1`,
          [emailLower, uid]
        );
        if (riderRes.rows.length > 0) {
          const dp = riderRes.rows[0];
          if (dp.status === 'APPROVED' || dp.is_online === true) {
            return {
              authorized: true,
              requiresPin: false,
              isProfileComplete: Boolean(dp.name && dp.phone),
              user: {
                uid: dp.id || uid,
                email: dp.email || emailLower,
                name: dp.name || 'Delivery Partner',
                role: 'delivery_partner',
                branchId: dp.branch_id || 'main_branch',
                branchName: 'Olive Pizza — Rajnandgaon HQ',
                branchIds: [dp.branch_id || 'main_branch'],
                franchiseId: dp.franchise_id || 'fra_rajnandgaon',
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
      } catch (riderErr: any) {
        console.warn('[FranchiseAccessService] PostgreSQL delivery_partners lookup notice:', riderErr.message);
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

    // 2. Normalize Phone Number and Fetch user profile
    const rawPhone = (phoneNumber || '').trim();
    const cleanPhone = rawPhone.replace(/[^0-9]/g, '');
    const phoneWithPlus91 = cleanPhone.length === 10 ? `+91${cleanPhone}` : (cleanPhone.length === 12 && cleanPhone.startsWith('91') ? `+${cleanPhone}` : rawPhone);
    const phone10Digit = cleanPhone.length >= 10 ? cleanPhone.slice(-10) : '';

    const fastFirestore = async <T>(promise: Promise<T>, fallback: T): Promise<T> => {
      return Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), 3000))
      ]).catch(() => fallback);
    };

    let userData: any = null;
    let userSnap = await fastFirestore(adminDb.collection('users').doc(uid).get(), null);
    if (userSnap && userSnap.exists) {
      userData = userSnap.data();
    }

    // If user document is missing or is just default 'customer', check if owner created a staff profile with this email or phone
    const hasPrivilegedRole = userData && userData.role && userData.role !== 'customer';
    if (!hasPrivilegedRole) {
      // Try secondary lookup in users collection by email
      if (emailLower) {
        const qEmail = await fastFirestore(adminDb.collection('users').where('email', '==', emailLower).limit(1).get(), { empty: true, docs: [] } as any);
        if (!qEmail.empty && qEmail.docs[0].id !== uid) {
          const matchedUser = qEmail.docs[0].data();
          if (matchedUser.role && matchedUser.role !== 'customer') {
            userData = { ...matchedUser, ...userData, role: matchedUser.role };
          }
        }
      }
      // Try secondary lookup in users collection by phone
      if (!userData?.role || userData.role === 'customer') {
        const phoneQueries = [phoneWithPlus91, phone10Digit].filter(Boolean);
        for (const p of phoneQueries) {
          const qPhone = await fastFirestore(adminDb.collection('users').where('phoneNumber', '==', p).limit(1).get(), { empty: true, docs: [] } as any);
          if (!qPhone.empty) {
            const matchedUser = qPhone.docs[0].data();
            if (matchedUser.role && matchedUser.role !== 'customer') {
              userData = { ...matchedUser, ...userData, role: matchedUser.role };
              break;
            }
          }
        }
      }
    }

    // Check if account has Owner permissions / isOwnerMode
    const isOwnerByProfile = Boolean(
      userData && (
        userData.isOwnerMode === true ||
        userData.isGlobalOwner === true ||
        userData.admin === true ||
        (userData.role || '').toLowerCase() === 'owner' ||
        (userData.role || '').toLowerCase() === 'platform_owner'
      )
    );

    if (isOwnerByProfile) {
      let resolvedBranch = requestedBranchId || userData?.branchId || 'main_branch';
      let resolvedFranchise = userData?.franchiseId || 'fra_rajnandgaon';
      if (resolvedFranchise === 'fra_primary' || !resolvedFranchise) resolvedFranchise = 'fra_rajnandgaon';
      if (resolvedBranch === 'fra_primary' || !resolvedBranch) resolvedBranch = 'main_branch';

      const roleMap: Record<string, string> = {
        OWNER: 'owner',
        RESTAURANT_MANAGER: 'restaurant_manager',
        DELIVERY: 'delivery_partner',
        POS: 'pos_operator',
        FRANCHISE_MANAGER: 'franchise_manager',
        CUSTOMER: 'customer'
      };

      return {
        authorized: true,
        requiresPin: false,
        isProfileComplete: true,
        user: {
          uid: userData.uid || uid,
          email: emailLower || userData.email || '',
          name: userData.name || userData.displayName || 'Olive Pizza Owner',
          role: roleMap[targetApp] || 'owner',
          phone: userData.phone || userData.phoneNumber || '+919179944445',
          phoneNumber: userData.phone || userData.phoneNumber || '+919179944445',
          branchId: resolvedBranch,
          branchName: 'Olive Pizza — Rajnandgaon HQ',
          branchIds: ['all', resolvedBranch],
          franchiseId: resolvedFranchise,
          terminalId: userData.terminalId || terminalId || 'Counter 1',
          permissions: ['*'],
          allowedApps: ['OWNER', 'RESTAURANT_MANAGER', 'DELIVERY', 'POS', 'FRANCHISE_MANAGER', 'CUSTOMER'],
          applicationAccess: {
            app_restaurant_management: true,
            app_delivery: true,
            app_pos: true,
            app_franchise_management: true,
            app_owner: true
          }
        }
      };
    }

    // Owner app check: Non-owners cannot access Owner command center
    if (targetApp === 'OWNER') {
      return {
        authorized: false,
        code: 'ACCESS_DENIED',
        reason: 'This account is not authorized to access the Olive Pizza Owner Command Center.'
      };
    }

    // 4. Check if account is suspended / deactivated
    if (userData && (userData.isActive === false || userData.isBlocked === true || userData.status === 'suspended' || userData.status === 'SUSPENDED')) {
      return {
        authorized: false,
        code: 'ACCOUNT_DEACTIVATED',
        reason: 'This account has been deactivated by the store owner.'
      };
    }

    // 5. Look up franchise assignments from franchises collection directly
    let assignedFranchiseDoc: any = null;
    let assignedRoleFromFranchise = '';

    if (emailLower) {
      const bSnap = await fastFirestore(adminDb.collection('franchises').get(), { docs: [] } as any);
      for (const d of bSnap.docs) {
        const b = d.data();
        if (b.restaurantManagerEmail && b.restaurantManagerEmail.toLowerCase().trim() === emailLower) {
          assignedFranchiseDoc = { id: d.id, ...b };
          assignedRoleFromFranchise = 'restaurant_manager';
          break;
        }
        if (b.franchiseOwnerEmail && b.franchiseOwnerEmail.toLowerCase().trim() === emailLower) {
          assignedFranchiseDoc = { id: d.id, ...b };
          assignedRoleFromFranchise = 'franchise_owner';
          break;
        }
      }

      if (!assignedFranchiseDoc) {
        const feSnap = await fastFirestore(adminDb.collection('franchise_entities').get(), { docs: [] } as any);
        for (const d of feSnap.docs) {
          const fe = d.data();
          if (fe.restaurantManagerEmail && fe.restaurantManagerEmail.toLowerCase().trim() === emailLower) {
            assignedFranchiseDoc = { id: d.id, ...fe, mainBranchId: fe.mainBranchId || d.id };
            assignedRoleFromFranchise = 'restaurant_manager';
            break;
          }
          if (fe.franchiseOwnerEmail && fe.franchiseOwnerEmail.toLowerCase().trim() === emailLower) {
            assignedFranchiseDoc = { id: d.id, ...fe, mainBranchId: fe.mainBranchId || d.id };
            assignedRoleFromFranchise = 'franchise_owner';
            break;
          }
        }
      }
    }

    // 6. Check canonical franchiseAccess array on user
    const franchiseAccessList: FranchiseAccessEntry[] = Array.isArray(userData?.franchiseAccess) ? userData.franchiseAccess : [];
    const activeAccessEntries = franchiseAccessList.filter(fa => fa.status === 'ACTIVE');
    let activeAccessEntry: FranchiseAccessEntry | undefined;

    if (requestedBranchId) {
      activeAccessEntry = activeAccessEntries.find(fa => fa.branchId === requestedBranchId || fa.franchiseId === requestedBranchId);
    } else if (activeAccessEntries.length >= 1) {
      activeAccessEntry = activeAccessEntries[0];
    }

    let resolvedFranchiseId = activeAccessEntry?.franchiseId || assignedFranchiseDoc?.franchiseId || assignedFranchiseDoc?.id || userData?.franchiseId || 'fra_rajnandgaon';
    if (resolvedFranchiseId === 'fra_primary' || !resolvedFranchiseId) {
      resolvedFranchiseId = 'fra_rajnandgaon';
    }
    let resolvedBranchId = activeAccessEntry?.branchId || assignedFranchiseDoc?.mainBranchId || assignedFranchiseDoc?.id || userData?.branchId || requestedBranchId || 'main_branch';
    if (resolvedBranchId === 'fra_primary' || !resolvedBranchId) {
      resolvedBranchId = 'main_branch';
    }

    // 7. Verify franchise status: NOT DELETED OR SUSPENDED
    // Only verify real franchise IDs (starting with fra_ or matched as franchiseId), avoiding branch IDs like 'main_branch'
    const franchiseCheckIds = Array.from(new Set([resolvedFranchiseId].filter(Boolean)));
    for (const checkId of franchiseCheckIds) {
      const fCheckDoc = await adminDb.collection('franchises').doc(checkId).get().catch(() => null);
      const feCheckDoc = await adminDb.collection('franchise_entities').doc(checkId).get().catch(() => null);
      const fData = fCheckDoc?.exists ? fCheckDoc.data() : (feCheckDoc?.exists ? feCheckDoc.data() : null);

      if (fData) {
        const fStatus = String(fData?.status || '').toUpperCase();
        if (fStatus === 'DELETED' || fData.deletedAt) {
          return {
            authorized: false,
            code: 'FRANCHISE_DEACTIVATED',
            reason: 'This franchise has been deactivated or deleted by the Owner.'
          };
        }
        if (fStatus === 'DISABLED' || fStatus === 'SUSPENDED' || fStatus === 'INACTIVE' || fData.isActive === false) {
          return {
            authorized: false,
            code: 'FRANCHISE_DISABLED',
            reason: 'This franchise has been disabled by the Owner.'
          };
        }
      }
    }

    // 8. Application specific validation
    if (targetApp === 'RESTAURANT_MANAGER') {
      let isApproved = false;

      // Direct assignment check
      if (assignedRoleFromFranchise === 'restaurant_manager' || assignedRoleFromFranchise === 'franchise_owner') {
        isApproved = true;
      }

      // Check franchiseAccess
      if (activeAccessEntry?.applications?.restaurantManagement) {
        isApproved = true;
      }

      // Check users doc role & status
      const userRole = (userData?.role || '').toLowerCase();
      const userStatus = (userData?.status || '').toUpperCase();
      if ((userRole === 'restaurant_manager' || userRole === 'manager') && 
          (userStatus === 'APPROVED' || userStatus === 'ACTIVE' || userData?.isActive === true)) {
        isApproved = true;
      }

      // Check users doc applicationAccess
      if (userData?.applicationAccess?.app_restaurant_management || (Array.isArray(userData?.allowedApps) && userData.allowedApps.includes('RESTAURANT_MANAGER'))) {
        isApproved = true;
      }

      // Check restaurant_managers collection
      const rmDoc = await adminDb.collection('restaurant_managers').doc(uid).get().catch(() => null);
      let rmData = rmDoc?.exists ? rmDoc.data() : null;
      if (!rmData && emailLower) {
        const rmSnap = await adminDb.collection('restaurant_managers').where('email', '==', emailLower).limit(1).get().catch(() => ({ empty: true, docs: [] } as any));
        if (!rmSnap.empty) {
          rmData = rmSnap.docs[0].data();
        }
      }
      if (!rmData && (phoneWithPlus91 || phone10Digit)) {
        const phoneVariants = [phoneWithPlus91, phone10Digit].filter(Boolean);
        for (const p of phoneVariants) {
          const rmSnap = await adminDb.collection('restaurant_managers').where('phone', '==', p).limit(1).get().catch(() => ({ empty: true, docs: [] } as any));
          if (!rmSnap.empty) {
            rmData = rmSnap.docs[0].data();
            break;
          }
          const rmSnap2 = await adminDb.collection('restaurant_managers').where('phoneNumber', '==', p).limit(1).get().catch(() => ({ empty: true, docs: [] } as any));
          if (!rmSnap2.empty) {
            rmData = rmSnap2.docs[0].data();
            break;
          }
        }
      }

      if (rmData) {
        if (rmData.status === 'PENDING_OWNER_APPROVAL') {
          return { authorized: false, code: 'PENDING_OWNER_APPROVAL', reason: 'Your Restaurant Manager account is pending Owner approval.' };
        }
        if (rmData.status === 'REJECTED' || rmData.status === 'ACCOUNT_REJECTED') {
          return { authorized: false, code: 'ACCOUNT_REJECTED', reason: 'Your Restaurant Manager account was rejected by the Owner.' };
        }
        if (rmData.isActive === false || rmData.status === 'DEACTIVATED' || rmData.status === 'ACCOUNT_DEACTIVATED' || rmData.status === 'FRANCHISE_DELETED') {
          return { authorized: false, code: 'ACCOUNT_DEACTIVATED', reason: 'This Restaurant Manager account has been deactivated.' };
        }
        if (rmData.status === 'APPROVED' || rmData.isActive === true) {
          isApproved = true;
        }
      }

      if (!isApproved) {
        return {
          authorized: false,
          code: 'NOT_REGISTERED',
          reason: 'No Restaurant Manager record found for this account. Please request provisioning through your Store Owner.'
        };
      }

      // Dynamic PIN requirement: only require PIN if a pinHash is actually set on profile
      const requiresPin = Boolean(userData?.pinHash || rmData?.pinHash);

      return {
        authorized: true,
        requiresPin,
        isProfileComplete: true,
        user: {
          uid,
          email: emailLower,
          name: userData?.name || rmData?.name || assignedFranchiseDoc?.restaurantManagerName || 'Restaurant Manager',
          role: 'restaurant_manager',
          branchId: resolvedBranchId,
          branchName: assignedFranchiseDoc?.name || 'Olive Pizza Branch',
          branchIds: [resolvedBranchId],
          franchiseId: resolvedFranchiseId,
          permissions: ['dashboard.view', 'orders.live', 'orders.history', 'notifications.send', 'delivery.view', 'inventory.view'],
          allowedApps: ['RESTAURANT_MANAGER'],
          applicationAccess: { app_restaurant_management: true }
        }
      };
    }

    if (targetApp === 'POS') {
      let isApproved = false;
      let matchedRecord: any = null;

      // Direct assignment check from franchises
      if (assignedRoleFromFranchise === 'franchise_owner' || assignedRoleFromFranchise === 'restaurant_manager') {
        isApproved = true;
        matchedRecord = assignedFranchiseDoc;
      }

      // Check canonical franchiseAccess
      if (activeAccessEntry?.applications?.pos) {
        isApproved = true;
        matchedRecord = activeAccessEntry;
      }

      // Check users doc role & status
      const userRole = (userData?.role || '').toLowerCase();
      const userStatus = (userData?.status || '').toUpperCase();
      const posAllowedRoles = ['pos_operator', 'cashier', 'pos', 'manager', 'restaurant_manager', 'franchise_owner', 'store_manager', 'counter_staff', 'staff', 'admin', 'owner'];
      if (posAllowedRoles.includes(userRole) && 
          (userStatus === 'APPROVED' || userStatus === 'ACTIVE' || userData?.isActive === true || !userData?.status)) {
        isApproved = true;
        matchedRecord = matchedRecord || userData;
      }

      // Check users doc applicationAccess
      if (userData?.applicationAccess?.app_pos || (Array.isArray(userData?.allowedApps) && userData.allowedApps.includes('POS'))) {
        isApproved = true;
        matchedRecord = matchedRecord || userData;
      }

      // Check restaurant_managers collection (managers authorized by owner can access POS)
      if (!isApproved) {
        let rmDoc = await fastFirestore(adminDb.collection('restaurant_managers').doc(uid).get(), null);
        let rmData = rmDoc?.exists ? rmDoc.data() : null;
        if (!rmData && emailLower) {
          const rmSnap = await fastFirestore(adminDb.collection('restaurant_managers').where('email', '==', emailLower).limit(1).get(), { empty: true, docs: [] } as any);
          if (!rmSnap.empty) {
            rmData = rmSnap.docs[0].data();
          }
        }
        if (!rmData && (phoneWithPlus91 || phone10Digit || rawPhone)) {
          const pList = [phoneWithPlus91, phone10Digit, rawPhone, cleanPhone].filter(Boolean);
          for (const p of pList) {
            const rmSnap = await fastFirestore(adminDb.collection('restaurant_managers').where('phone', '==', p).limit(1).get(), { empty: true, docs: [] } as any);
            if (!rmSnap.empty) {
              rmData = rmSnap.docs[0].data();
              break;
            }
          }
        }
        if (rmData && (rmData.status === 'APPROVED' || rmData.status === 'ACTIVE' || rmData.isActive === true || !rmData.status)) {
          isApproved = true;
          matchedRecord = matchedRecord || rmData;
        }
      }

      // Check pos_accounts collection
      const posDoc = await fastFirestore(adminDb.collection('pos_accounts').doc(uid).get(), null);
      let posData = posDoc?.exists ? posDoc.data() : null;
      if (!posData && emailLower) {
        const pSnap = await fastFirestore(adminDb.collection('pos_accounts').where('email', '==', emailLower).limit(1).get(), { empty: true, docs: [] } as any);
        if (!pSnap.empty) {
          posData = pSnap.docs[0].data();
        }
      }
      if (!posData && (phoneWithPlus91 || phone10Digit || rawPhone)) {
        const phoneVariants = [phoneWithPlus91, phone10Digit, rawPhone, cleanPhone].filter(Boolean);
        for (const p of phoneVariants) {
          const pSnap = await fastFirestore(adminDb.collection('pos_accounts').where('phone', '==', p).limit(1).get(), { empty: true, docs: [] } as any);
          if (!pSnap.empty) {
            posData = pSnap.docs[0].data();
            break;
          }
          const pSnap2 = await fastFirestore(adminDb.collection('pos_accounts').where('phoneNumber', '==', p).limit(1).get(), { empty: true, docs: [] } as any);
          if (!pSnap2.empty) {
            posData = pSnap2.docs[0].data();
            break;
          }
        }
      }

      if (posData) {
        if (posData.status === 'PENDING_OWNER_APPROVAL') {
          return { authorized: false, code: 'PENDING_OWNER_APPROVAL', reason: 'Your POS account is pending Owner approval.' };
        }
        if (posData.status === 'REJECTED') {
          return { authorized: false, code: 'ACCOUNT_REJECTED', reason: 'Your POS account was rejected by the store owner.' };
        }
        if (posData.status === 'REVOKED' || posData.isActive === false) {
          return { authorized: false, code: 'ACCOUNT_REVOKED', reason: 'Your POS account access has been revoked.' };
        }
        if (posData.status === 'APPROVED' || posData.status === 'ACTIVE' || posData.isActive === true || !posData.status) {
          isApproved = true;
          matchedRecord = matchedRecord || posData;
        }
      }

      if (!isApproved) {
        return {
          authorized: false,
          code: 'NOT_AUTHORIZED_FOR_POS',
          reason: 'Access denied. Only the Franchise Manager and authorized POS accounts are permitted to access POS.'
        };
      }

      // Dynamic PIN requirement
      const requiresPin = Boolean(userData?.pinHash || posData?.pinHash || matchedRecord?.pinHash);

      let finalPosBranch = resolvedBranchId || matchedRecord?.branchId || matchedRecord?.mainBranchId;
      let finalPosFranchise = resolvedFranchiseId || matchedRecord?.franchiseId;
      if (!finalPosBranch || !finalPosFranchise) {
        try {
          const bRes = await query(`SELECT id, franchise_id FROM restaurant_branches WHERE is_active = true ORDER BY created_at ASC LIMIT 1`);
          if (bRes.rows.length > 0) {
            finalPosBranch = finalPosBranch || bRes.rows[0].id;
            finalPosFranchise = finalPosFranchise || bRes.rows[0].franchise_id;
          }
        } catch (_) {}
        finalPosBranch = finalPosBranch || 'main_branch';
        finalPosFranchise = finalPosFranchise || 'fra_rajnandgaon';
      }

      return {
        authorized: true,
        requiresPin,
        isProfileComplete: true,
        user: {
          uid,
          email: emailLower || matchedRecord?.email || '',
          name: userData?.name || posData?.name || matchedRecord?.name || matchedRecord?.displayName || 'POS Operator',
          role: userData?.role || posData?.role || matchedRecord?.role || 'pos_operator',
          branchId: finalPosBranch,
          branchName: assignedFranchiseDoc?.name || matchedRecord?.branchName || 'Olive Pizza Branch',
          branchIds: [finalPosBranch],
          franchiseId: finalPosFranchise,
          terminalId: terminalId || 'Counter 1',
          permissions: matchedRecord?.permissions || ['pos.billing', 'orders.create', 'orders.view'],
          allowedApps: ['POS'],
          applicationAccess: { app_pos: true }
        }
      };
    }

    if (targetApp === 'FRANCHISE_MANAGER') {
      let isApproved = false;

      if (assignedRoleFromFranchise === 'franchise_owner') {
        isApproved = true;
      }
      if (activeAccessEntry?.applications?.franchiseManagement) {
        isApproved = true;
      }

      const userRole = (userData?.role || '').toLowerCase();
      const userStatus = (userData?.status || '').toUpperCase();
      if ((userRole === 'franchise_manager' || userRole === 'franchise_owner') &&
          (userStatus === 'APPROVED' || userStatus === 'ACTIVE' || userData?.isActive === true)) {
        isApproved = true;
      }

      if (userData?.applicationAccess?.app_franchise_management || (Array.isArray(userData?.allowedApps) && userData.allowedApps.includes('FRANCHISE_MANAGER'))) {
        isApproved = true;
      }

      const fuDoc = await adminDb.collection('franchise_users').doc(uid).get().catch(() => null);
      let fuData = fuDoc?.exists ? fuDoc.data() : null;
      if (!fuData && emailLower) {
        const fuSnap = await adminDb.collection('franchise_users').where('email', '==', emailLower).limit(1).get().catch(() => ({ empty: true, docs: [] } as any));
        if (!fuSnap.empty) {
          fuData = fuSnap.docs[0].data();
        }
      }

      if (fuData) {
        if (fuData.status === 'PENDING' || fuData.status === 'PENDING_OWNER_APPROVAL') {
          return { authorized: false, code: 'PENDING_OWNER_APPROVAL', reason: 'Your Franchise Manager account is pending Owner approval.' };
        }
        if (fuData.isActive === false || fuData.status === 'DEACTIVATED' || fuData.status === 'FRANCHISE_DELETED') {
          return { authorized: false, code: 'ACCOUNT_DEACTIVATED', reason: 'This Franchise Manager account has been deactivated.' };
        }
        if (fuData.status === 'APPROVED' || fuData.isActive === true) {
          isApproved = true;
        }
      }

      if (!isApproved) {
        return {
          authorized: false,
          code: 'NOT_REGISTERED',
          reason: 'No Franchise Manager record found for this account. Please request provisioning through the Platform Owner.'
        };
      }

      const hasPosAccess = Boolean(
        activeAccessEntry?.applications?.pos ||
        userData?.applicationAccess?.app_pos ||
        (Array.isArray(userData?.allowedApps) && userData.allowedApps.includes('POS'))
      );
      const allowedApps = ['FRANCHISE_MANAGER'];
      const applicationAccess: Record<string, boolean> = { app_franchise_management: true };
      if (hasPosAccess) {
        allowedApps.push('POS');
        applicationAccess.app_pos = true;
      }

      return {
        authorized: true,
        requiresPin: false,
        isProfileComplete: true,
        user: {
          uid,
          email: emailLower,
          name: userData?.name || fuData?.name || assignedFranchiseDoc?.franchiseOwnerName || 'Franchise Partner',
          role: 'franchise_manager',
          branchId: resolvedBranchId,
          branchName: assignedFranchiseDoc?.name || 'Olive Pizza Franchise',
          branchIds: [resolvedBranchId],
          franchiseId: resolvedFranchiseId,
          permissions: ['franchise.dashboard', 'reports.view', 'staff.manage'],
          allowedApps,
          applicationAccess
        }
      };
    }

    if (targetApp === 'DELIVERY') {
      let isApproved = false;

      if (activeAccessEntry?.applications?.delivery) {
        isApproved = true;
      }

      const userRole = (userData?.role || '').toLowerCase();
      const userStatus = (userData?.status || '').toUpperCase();
      if ((userRole === 'delivery_partner' || userRole === 'delivery' || userRole === 'rider') &&
          (userStatus === 'APPROVED' || userStatus === 'ACTIVE' || userData?.isActive === true)) {
        isApproved = true;
      }

      if (userData?.applicationAccess?.app_delivery || (Array.isArray(userData?.allowedApps) && userData.allowedApps.includes('DELIVERY'))) {
        isApproved = true;
      }

      const dpDoc = await adminDb.collection('delivery_partners').doc(uid).get().catch(() => null);
      let dpData = dpDoc?.exists ? dpDoc.data() : null;
      if (!dpData && emailLower) {
        const dpSnap = await adminDb.collection('delivery_partners').where('email', '==', emailLower).limit(1).get().catch(() => ({ empty: true, docs: [] } as any));
        if (!dpSnap.empty) {
          dpData = dpSnap.docs[0].data();
        }
      }
      if (!dpData && (phoneWithPlus91 || phone10Digit)) {
        const phoneVariants = [phoneWithPlus91, phone10Digit].filter(Boolean);
        for (const p of phoneVariants) {
          const dpSnap = await adminDb.collection('delivery_partners').where('phone', '==', p).limit(1).get().catch(() => ({ empty: true, docs: [] } as any));
          if (!dpSnap.empty) {
            dpData = dpSnap.docs[0].data();
            break;
          }
          const dpSnap2 = await adminDb.collection('delivery_partners').where('phoneNumber', '==', p).limit(1).get().catch(() => ({ empty: true, docs: [] } as any));
          if (!dpSnap2.empty) {
            dpData = dpSnap2.docs[0].data();
            break;
          }
        }
      }

      if (dpData) {
        if (dpData.status === 'PENDING' || dpData.status === 'PENDING_OWNER_APPROVAL') {
          return { authorized: false, code: 'PENDING_OWNER_APPROVAL', reason: 'Your Delivery Partner account is pending Owner approval.' };
        }
        if (dpData.isActive === false || dpData.status === 'suspended' || dpData.status === 'BLOCKED') {
          return { authorized: false, code: 'ACCOUNT_INACTIVE', reason: 'Your delivery rider account is inactive or suspended.' };
        }
        if (
          dpData.status === 'approved' ||
          dpData.status === 'APPROVED' ||
          dpData.status === 'online' ||
          dpData.status === 'active' ||
          dpData.approvalStatus === 'approved' ||
          dpData.approvalStatus === 'APPROVED' ||
          dpData.isActive === true
        ) {
          isApproved = true;
        }
      }

      if (!isApproved) {
        return {
          authorized: false,
          code: 'NOT_REGISTERED',
          reason: 'Your account is not registered as an authorized Olive Pizza delivery partner.'
        };
      }

      return {
        authorized: true,
        requiresPin: false,
        isProfileComplete: Boolean(dpData?.vehicleNumber || dpData?.name),
        user: {
          uid,
          email: emailLower,
          name: dpData?.name || userData?.name || 'Delivery Partner',
          role: 'delivery_partner',
          branchId: resolvedBranchId,
          branchName: assignedFranchiseDoc?.name || 'Olive Pizza Branch',
          branchIds: [resolvedBranchId],
          franchiseId: resolvedFranchiseId,
          permissions: ['delivery.orders', 'delivery.location'],
          allowedApps: ['DELIVERY'],
          applicationAccess: { app_delivery: true }
        }
      };
    }

    return {
      authorized: false,
      reason: 'Unknown application target'
    };
  }
}
