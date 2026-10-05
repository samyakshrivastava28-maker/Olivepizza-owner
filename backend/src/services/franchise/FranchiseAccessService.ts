import { adminDb, adminAuth } from '../../config/firebase.js';
import { FranchiseScopeService } from './FranchiseScopeService.js';

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
        }
      } else {
        // Try looking up in restaurant_managers or franchise_users
        const rmDoc = await adminDb.collection('restaurant_managers').doc(targetUserId).get();
        if (rmDoc.exists) {
          email = (rmDoc.data()?.email || '').toLowerCase().trim();
        }
      }
    }

    // If still no user doc, look up via Firebase Auth
    if (!email && adminAuth) {
      const authUser = await adminAuth.getUser(targetUserId).catch(() => null);
      if (authUser?.email) {
        email = authUser.email.toLowerCase().trim();
      }
    }

    const effectiveBranchId = branchId || (userDocSnap.exists ? userDocSnap.data()?.branchId : 'main_branch') || 'main_branch';

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

    // 1. Platform Owner Check
    const isMasterOwner =
      emailLower === 'olivepizzarjn@gmail.com' ||
      emailLower === 'webhub2811@gmail.com' ||
      emailLower === 'olivepizzamaker@gmail.com';

    // 2. Fetch user profile
    let userData: any = null;
    let userSnap = await adminDb.collection('users').doc(uid).get().catch(() => null);
    if (userSnap && userSnap.exists) {
      userData = userSnap.data();
    } else if (emailLower) {
      const q = await adminDb.collection('users').where('email', '==', emailLower).limit(1).get().catch(() => ({ empty: true, docs: [] } as any));
      if (!q.empty) {
        userData = q.docs[0].data();
      }
    }

    const isOwnerRole = isMasterOwner || userData?.role === 'owner' || userData?.role === 'platform_owner';

    // Platform Owners have universal access to all apps (in administrative mode)
    if (isOwnerRole) {
      const resolvedBranch = requestedBranchId || userData?.branchId || 'main_branch';
      const resolvedFranchise = userData?.franchiseId || 'fra_rajnandgaon';

      return {
        authorized: true,
        requiresPin: false,
        isProfileComplete: true,
        user: {
          uid,
          email: emailLower || 'owner@olivepizza.in',
          name: userData?.name || (isMasterOwner ? 'Platform Owner' : 'Olive Pizza Administrator'),
          role: targetApp === 'OWNER' ? 'owner' : (targetApp === 'RESTAURANT_MANAGER' ? 'restaurant_manager' : (targetApp === 'POS' ? 'pos_operator' : 'owner')),
          branchId: resolvedBranch,
          branchName: 'Olive Pizza Enterprise',
          branchIds: ['all'],
          franchiseId: resolvedFranchise,
          terminalId: terminalId || 'Counter 1',
          permissions: ['*'],
          allowedApps: ['OWNER', 'RESTAURANT_MANAGER', 'FRANCHISE_MANAGER', 'POS', 'DELIVERY', 'CUSTOMER'],
          applicationAccess: {
            app_restaurant_management: true,
            app_franchise_management: true,
            app_pos: true,
            app_delivery: true
          }
        }
      };
    }

    // 3. Customer application check
    if (targetApp === 'CUSTOMER') {
      return {
        authorized: true,
        requiresPin: false,
        isProfileComplete: true,
        user: {
          uid,
          email: emailLower,
          name: userData?.name || emailLower.split('@')[0] || 'Customer',
          role: 'customer',
          branchId: 'main_branch',
          branchName: 'Olive Pizza',
          branchIds: ['main_branch'],
          franchiseId: 'fra_rajnandgaon',
          permissions: ['customer.order'],
          allowedApps: ['CUSTOMER'],
          applicationAccess: {}
        }
      };
    }

    // 4. Check if account is suspended / deactivated
    if (userData && (userData.isActive === false || userData.isBlocked === true || userData.status === 'suspended' || userData.status === 'SUSPENDED' || userData.status === 'REVOKED')) {
      return {
        authorized: false,
        code: 'ACCOUNT_DEACTIVATED',
        reason: 'This account has been deactivated or revoked by the store owner.'
      };
    }

    // 5. Look up franchise assignments from franchises collection directly
    // This handles cases where an owner entered the manager's email in the franchise modal
    let assignedFranchiseDoc: any = null;
    let assignedRoleFromFranchise = '';

    if (emailLower) {
      const bSnap = await adminDb.collection('franchises').get().catch(() => ({ docs: [] } as any));
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
        const feSnap = await adminDb.collection('franchise_entities').get().catch(() => ({ docs: [] } as any));
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
    const activeAccessEntry = franchiseAccessList.find(fa => fa.status === 'ACTIVE');

    const resolvedFranchiseId = activeAccessEntry?.franchiseId || assignedFranchiseDoc?.franchiseId || assignedFranchiseDoc?.id || userData?.franchiseId || 'fra_rajnandgaon';
    const resolvedBranchId = activeAccessEntry?.branchId || assignedFranchiseDoc?.mainBranchId || assignedFranchiseDoc?.id || userData?.branchId || requestedBranchId || 'main_branch';

    // 7. Verify franchise status: NOT DELETED OR SUSPENDED
    if (resolvedFranchiseId) {
      const fCheckDoc = await adminDb.collection('franchises').doc(resolvedFranchiseId).get().catch(() => null);
      const feCheckDoc = await adminDb.collection('franchise_entities').doc(resolvedFranchiseId).get().catch(() => null);
      const fData = fCheckDoc?.exists ? fCheckDoc.data() : (feCheckDoc?.exists ? feCheckDoc.data() : null);

      if (fData && (fData.status === 'deleted' || fData.status === 'DELETED' || fData.deletedAt)) {
        return {
          authorized: false,
          code: 'FRANCHISE_DEACTIVATED',
          reason: 'This franchise has been deactivated or deleted by the Owner.'
        };
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

      // Auto-heal: Ensure users document and restaurant_managers document have APPROVED status and app access
      adminDb.collection('restaurant_managers').doc(uid).set({
        id: uid,
        email: emailLower,
        status: 'APPROVED',
        isActive: true,
        branchId: resolvedBranchId,
        franchiseId: resolvedFranchiseId,
        updatedAt: new Date().toISOString()
      }, { merge: true }).catch(() => {});

      adminDb.collection('users').doc(uid).set({
        role: 'restaurant_manager',
        allowedApps: Array.from(new Set([...(userData?.allowedApps || []), 'RESTAURANT_MANAGER'])),
        applicationAccess: { ...(userData?.applicationAccess || {}), app_restaurant_management: true },
        branchId: resolvedBranchId,
        franchiseId: resolvedFranchiseId,
        status: 'APPROVED',
        isActive: true
      }, { merge: true }).catch(() => {});

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

      // Direct assignment check
      if (assignedRoleFromFranchise === 'franchise_owner' || assignedRoleFromFranchise === 'restaurant_manager') {
        isApproved = true;
      }

      // Check franchiseAccess
      if (activeAccessEntry?.applications?.pos) {
        isApproved = true;
      }

      // Check users doc role & status
      const userRole = (userData?.role || '').toLowerCase();
      const userStatus = (userData?.status || '').toUpperCase();
      if ((userRole === 'pos_operator' || userRole === 'cashier' || userRole === 'pos' || userRole === 'manager' || userRole === 'restaurant_manager') && 
          (userStatus === 'APPROVED' || userStatus === 'ACTIVE' || userData?.isActive === true)) {
        isApproved = true;
      }

      // Check users doc applicationAccess
      if (userData?.applicationAccess?.app_pos || (Array.isArray(userData?.allowedApps) && userData.allowedApps.includes('POS'))) {
        isApproved = true;
      }

      // Check pos_accounts collection
      const posDoc = await adminDb.collection('pos_accounts').doc(uid).get().catch(() => null);
      let posData = posDoc?.exists ? posDoc.data() : null;
      if (!posData && emailLower) {
        const pSnap = await adminDb.collection('pos_accounts').where('email', '==', emailLower).limit(1).get().catch(() => ({ empty: true, docs: [] } as any));
        if (!pSnap.empty) {
          posData = pSnap.docs[0].data();
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
        if (posData.status === 'APPROVED' || posData.status === 'ACTIVE' || posData.isActive === true) {
          isApproved = true;
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
      const requiresPin = Boolean(userData?.pinHash || posData?.pinHash);

      // Auto-heal
      adminDb.collection('pos_accounts').doc(uid).set({
        id: uid,
        email: emailLower,
        status: 'APPROVED',
        isActive: true,
        franchiseId: resolvedFranchiseId,
        branchId: resolvedBranchId,
        updatedAt: new Date().toISOString()
      }, { merge: true }).catch(() => {});

      adminDb.collection('users').doc(uid).set({
        allowedApps: Array.from(new Set([...(userData?.allowedApps || []), 'POS'])),
        applicationAccess: { ...(userData?.applicationAccess || {}), app_pos: true },
        franchiseId: resolvedFranchiseId,
        branchId: resolvedBranchId,
        status: 'APPROVED',
        isActive: true
      }, { merge: true }).catch(() => {});

      return {
        authorized: true,
        requiresPin,
        isProfileComplete: true,
        user: {
          uid,
          email: emailLower,
          name: userData?.name || posData?.name || 'POS Operator',
          role: 'pos_operator',
          branchId: resolvedBranchId,
          branchName: assignedFranchiseDoc?.name || 'Olive Pizza Branch',
          branchIds: [resolvedBranchId],
          franchiseId: resolvedFranchiseId,
          terminalId: terminalId || 'Counter 1',
          permissions: ['pos.billing', 'orders.create', 'orders.view'],
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

      // Auto-heal
      adminDb.collection('franchise_users').doc(uid).set({
        id: uid,
        email: emailLower,
        status: 'APPROVED',
        isActive: true,
        franchiseId: resolvedFranchiseId,
        updatedAt: new Date().toISOString()
      }, { merge: true }).catch(() => {});

      adminDb.collection('users').doc(uid).set({
        allowedApps: Array.from(new Set([...(userData?.allowedApps || []), 'FRANCHISE_MANAGER'])),
        applicationAccess: { ...(userData?.applicationAccess || {}), app_franchise_management: true },
        franchiseId: resolvedFranchiseId,
        status: 'APPROVED',
        isActive: true
      }, { merge: true }).catch(() => {});

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
          allowedApps: ['FRANCHISE_MANAGER', 'POS'],
          applicationAccess: { app_franchise_management: true, app_pos: true }
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

      if (dpData) {
        if (dpData.status === 'PENDING' || dpData.status === 'PENDING_OWNER_APPROVAL') {
          return { authorized: false, code: 'PENDING_OWNER_APPROVAL', reason: 'Your Delivery Partner account is pending Owner approval.' };
        }
        if (dpData.isActive === false || dpData.status === 'suspended' || dpData.status === 'BLOCKED') {
          return { authorized: false, code: 'ACCOUNT_INACTIVE', reason: 'Your delivery rider account is inactive or suspended.' };
        }
        if (dpData.status === 'approved' || dpData.status === 'APPROVED' || dpData.isActive === true) {
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

      // Auto-heal
      adminDb.collection('delivery_partners').doc(uid).set({
        id: uid,
        email: emailLower,
        status: 'approved',
        isActive: true,
        franchiseId: resolvedFranchiseId,
        branchId: resolvedBranchId,
        updatedAt: new Date().toISOString()
      }, { merge: true }).catch(() => {});

      adminDb.collection('users').doc(uid).set({
        allowedApps: Array.from(new Set([...(userData?.allowedApps || []), 'DELIVERY'])),
        applicationAccess: { ...(userData?.applicationAccess || {}), app_delivery: true },
        franchiseId: resolvedFranchiseId,
        branchId: resolvedBranchId,
        status: 'APPROVED',
        isActive: true
      }, { merge: true }).catch(() => {});

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
