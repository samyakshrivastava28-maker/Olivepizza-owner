import { adminDb, adminAuth } from '../../config/firebase.js';
import { AuthAuditService } from './AuthAuditService.js';

export type PosAccountStatus = 'PENDING_OWNER_APPROVAL' | 'APPROVED' | 'ACTIVE' | 'REJECTED' | 'REVOKED';

export interface PosAccountData {
  id: string;
  name: string;
  email: string;
  franchiseId: string;
  status: PosAccountStatus;
  createdAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  revokedAt?: string;
  approvedBy?: string;
  pinConfigured?: boolean;
}

export class PosAccountService {
  private static readonly COLLECTION = 'pos_accounts';

  /**
   * Check if a franchise already has an active, approved, or pending POS account.
   */
  public static async getExistingPosAccount(franchiseId: string): Promise<PosAccountData | null> {
    if (!adminDb) return null;

    const snapshot = await adminDb
      .collection(this.COLLECTION)
      .where('franchiseId', '==', franchiseId)
      .where('status', 'in', ['PENDING_OWNER_APPROVAL', 'APPROVED', 'ACTIVE'])
      .limit(1)
      .get();

    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as PosAccountData;
  }

  /**
   * Franchise Manager creates a POS account for their franchise.
   * Strictly enforces exactly 1 POS account per franchise.
   */
  public static async createPosAccount(params: {
    franchiseId: string;
    name: string;
    email: string;
    password?: string;
    createdBy: string;
  }): Promise<{ success: boolean; message: string; posAccount?: PosAccountData }> {
    const { franchiseId, name, email, password, createdBy } = params;

    if (!franchiseId || !email || !name) {
      return { success: false, message: 'Franchise ID, terminal name, and email are required.' };
    }

    const cleanEmail = email.toLowerCase().trim();

    if (!adminDb || !adminAuth) {
      return { success: false, message: 'Firebase service unavailable.' };
    }

    // 1. Enforce 1 POS account per franchise constraint
    const existing = await this.getExistingPosAccount(franchiseId);
    if (existing) {
      return {
        success: false,
        message: `A POS account already exists for this franchise (${existing.email}, status: ${existing.status}). Only 1 POS account is permitted per franchise.`,
      };
    }

    // 2. Create or verify Firebase Auth user
    let uid: string;
    try {
      const existingAuthUser = await adminAuth.getUserByEmail(cleanEmail).catch(() => null);
      if (existingAuthUser) {
        uid = existingAuthUser.uid;
      } else {
        if (!password || password.length < 6) {
          return { success: false, message: 'A valid password (minimum 6 characters) is required to create a new POS account.' };
        }
        const newUser = await adminAuth.createUser({
          email: cleanEmail,
          password: password,
          displayName: name,
        });
        uid = newUser.uid;
      }

      // Set custom claims: role 'pos_operator', franchiseId, approved false
      await adminAuth.setCustomUserClaims(uid, {
        role: 'pos_operator',
        franchiseId,
        posApproved: false,
      });
    } catch (err: any) {
      console.error('[PosAccountService] Auth user creation failed:', err);
      return { success: false, message: `Failed to create auth user: ${err.message}` };
    }

    // 3. Store record in pos_accounts collection with status PENDING_OWNER_APPROVAL
    const posAccount: PosAccountData = {
      id: uid,
      name,
      email: cleanEmail,
      franchiseId,
      status: 'PENDING_OWNER_APPROVAL',
      createdAt: new Date().toISOString(),
      pinConfigured: false,
    };

    await adminDb.collection(this.COLLECTION).doc(uid).set({
      ...posAccount,
      createdBy,
      updatedAt: new Date().toISOString(),
    });

    // Also mirror into users collection with role pos_operator
    await adminDb.collection('users').doc(uid).set({
      uid,
      email: cleanEmail,
      displayName: name,
      role: 'pos_operator',
      franchiseId,
      status: 'PENDING_OWNER_APPROVAL',
      emailVerified: true, // Internal operational user created by manager
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    await AuthAuditService.logEvent({
      eventType: 'POS_ACCOUNT_CREATED',
      userId: uid,
      identifier: cleanEmail,
      franchiseId,
      status: 'SUCCESS',
      metadata: { name, createdBy },
    });

    return {
      success: true,
      message: 'POS account created successfully and is now PENDING OWNER APPROVAL.',
      posAccount,
    };
  }

  /**
   * Owner approves a pending POS account.
   */
  public static async approvePosAccount(posId: string, ownerEmail: string): Promise<{ success: boolean; message: string }> {
    if (!adminDb || !adminAuth) return { success: false, message: 'Database service unavailable.' };

    const ref = adminDb.collection(this.COLLECTION).doc(posId);
    const snap = await ref.get();

    if (!snap.exists) {
      return { success: false, message: 'POS account record not found.' };
    }

    const data = snap.data()!;
    const franchiseId = data.franchiseId;

    // Update status to APPROVED / ACTIVE
    const now = new Date().toISOString();
    await ref.update({
      status: 'APPROVED',
      approvedAt: now,
      approvedBy: ownerEmail,
      updatedAt: now,
    });

    // Update users collection
    await adminDb.collection('users').doc(posId).set({
      status: 'ACTIVE',
      posApproved: true,
      approvedAt: now,
      approvedBy: ownerEmail,
      updatedAt: now,
    }, { merge: true });

    // Update custom claims
    try {
      await adminAuth.setCustomUserClaims(posId, {
        role: 'pos_operator',
        franchiseId,
        posApproved: true,
      });
    } catch (err) {
      console.warn('[PosAccountService] Failed to set approved custom claims:', err);
    }

    await AuthAuditService.logEvent({
      eventType: 'POS_ACCOUNT_APPROVED',
      userId: posId,
      identifier: data.email,
      franchiseId,
      status: 'SUCCESS',
      metadata: { approvedBy: ownerEmail },
    });

    return { success: true, message: 'POS account has been approved and activated.' };
  }

  /**
   * Owner rejects a pending POS account.
   */
  public static async rejectPosAccount(posId: string, ownerEmail: string, reason?: string): Promise<{ success: boolean; message: string }> {
    if (!adminDb) return { success: false, message: 'Database service unavailable.' };

    const ref = adminDb.collection(this.COLLECTION).doc(posId);
    const snap = await ref.get();

    if (!snap.exists) {
      return { success: false, message: 'POS account record not found.' };
    }

    const data = snap.data()!;
    const now = new Date().toISOString();

    await ref.update({
      status: 'REJECTED',
      rejectedAt: now,
      rejectedBy: ownerEmail,
      rejectReason: reason || 'Rejected by Owner',
      updatedAt: now,
    });

    await adminDb.collection('users').doc(posId).set({
      status: 'REJECTED',
      posApproved: false,
      updatedAt: now,
    }, { merge: true });

    await AuthAuditService.logEvent({
      eventType: 'POS_ACCOUNT_REJECTED',
      userId: posId,
      identifier: data.email,
      franchiseId: data.franchiseId,
      status: 'SUCCESS',
      metadata: { rejectedBy: ownerEmail, reason },
    });

    return { success: true, message: 'POS account has been rejected.' };
  }

  /**
   * Owner revokes access for an active POS account.
   */
  public static async revokePosAccount(posId: string, ownerEmail: string): Promise<{ success: boolean; message: string }> {
    if (!adminDb) return { success: false, message: 'Database service unavailable.' };

    const ref = adminDb.collection(this.COLLECTION).doc(posId);
    const snap = await ref.get();

    if (!snap.exists) {
      return { success: false, message: 'POS account record not found.' };
    }

    const data = snap.data()!;
    const now = new Date().toISOString();

    await ref.update({
      status: 'REVOKED',
      revokedAt: now,
      revokedBy: ownerEmail,
      updatedAt: now,
    });

    await adminDb.collection('users').doc(posId).set({
      status: 'REVOKED',
      posApproved: false,
      updatedAt: now,
    }, { merge: true });

    // Revoke Firebase Auth session tokens if possible
    try {
      await adminAuth.revokeRefreshTokens(posId);
    } catch (err) {
      console.warn('[PosAccountService] Failed to revoke refresh tokens:', err);
    }

    await AuthAuditService.logEvent({
      eventType: 'POS_ACCOUNT_REVOKED',
      userId: posId,
      identifier: data.email,
      franchiseId: data.franchiseId,
      status: 'SUCCESS',
      metadata: { revokedBy: ownerEmail },
    });

    return { success: true, message: 'POS account access has been revoked.' };
  }

  /**
   * List POS accounts by franchise.
   */
  public static async listAccountsByFranchise(franchiseId: string): Promise<PosAccountData[]> {
    if (!adminDb) return [];
    const snapshot = await adminDb
      .collection(this.COLLECTION)
      .where('franchiseId', '==', franchiseId)
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PosAccountData));
  }

  /**
   * List all POS accounts pending Owner approval across all franchises.
   */
  public static async listPendingAccounts(): Promise<PosAccountData[]> {
    if (!adminDb) return [];
    const snapshot = await adminDb
      .collection(this.COLLECTION)
      .where('status', '==', 'PENDING_OWNER_APPROVAL')
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PosAccountData));
  }
}
