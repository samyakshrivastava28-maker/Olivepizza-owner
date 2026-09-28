import { Router, Request, Response } from 'express';
import { adminDb, adminAuth } from '../config/firebase.js';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth.middleware.js';
import kb from '../services/KnowledgeBaseService.js';

const router = Router();

router.use(verifyToken);
router.use(requireRole(['owner', 'admin']));

// ─── Field Whitelisting Helpers ──────────────────────────────────────────────
function filterProductFields(body: any) {
  const allowed = [
    'name', 'productName', 'category', 'basePrice', 'price', 'offerPrice',
    'description', 'imageUrl', 'image', 'isVegetarian', 'variants', 'crusts',
    'addons', 'channelAvailability', 'isAvailable', 'isActive', 'tags'
  ];
  const clean: Record<string, any> = {};
  for (const k of allowed) {
    if (body[k] !== undefined) clean[k] = body[k];
  }
  return clean;
}

function filterCouponFields(body: any) {
  const allowed = [
    'code', 'discountType', 'discountValue', 'minOrderAmount', 'maxDiscountAmount',
    'startDate', 'endDate', 'usageLimit', 'isActive', 'description', 'title'
  ];
  const clean: Record<string, any> = {};
  for (const k of allowed) {
    if (body[k] !== undefined) clean[k] = body[k];
  }
  return clean;
}

function filterComboFields(body: any) {
  const allowed = [
    'name', 'comboName', 'description', 'price', 'originalPrice', 'items',
    'imageUrl', 'isActive', 'category', 'badge', 'savings'
  ];
  const clean: Record<string, any> = {};
  for (const k of allowed) {
    if (body[k] !== undefined) clean[k] = body[k];
  }
  return clean;
}

// ─── Products CRUD ──────────────────────────────────────────────────────────
router.post('/products', async (req: AuthRequest, res: Response) => {
  try {
    const cleanFields = filterProductFields(req.body);
    const data = {
      ...cleanFields,
      createdAt: new Date().toISOString()
    };
    const docRef = await adminDb.collection('products').add(data);
    
    // Live Qdrant Embedding Upsert (Fire-and-forget promise)
    (kb as any).embedAndUpsert('products', docRef.id, data).catch((err: any) => console.error('[Admin] embedAndUpsert error:', err));

    res.status(201).json({ id: docRef.id, success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create product' });
  }
});

router.put('/products/:id', async (req: AuthRequest, res: Response) => {
  try {
    const docId = req.params.id;
    const cleanFields = filterProductFields(req.body);
    const data = {
      ...cleanFields,
      updatedAt: new Date().toISOString()
    };
    await adminDb.collection('products').doc(docId).update(data);
    
    // Live Qdrant Embedding Upsert
    (kb as any).embedAndUpsert('products', docId, data).catch((err: any) => console.error('[Admin] embedAndUpsert error:', err));

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update product' });
  }
});

router.delete('/products/:id', async (req: AuthRequest, res: Response) => {
  try {
    const docId = req.params.id;
    await adminDb.collection('products').doc(docId).delete();
    
    // Delete embedding vector
    (kb as any).deleteEmbedding('products', docId).catch((err: any) => console.error('[Admin] deleteEmbedding error:', err));

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// ─── Coupons CRUD ───────────────────────────────────────────────────────────
router.post('/coupons', async (req: AuthRequest, res: Response) => {
  try {
    const cleanFields = filterCouponFields(req.body);
    const data = { ...cleanFields, createdAt: new Date().toISOString() };
    const docRef = await adminDb.collection('coupons').add(data);
    (kb as any).embedAndUpsert('coupons', docRef.id, data).catch((err: any) => console.error('[Admin] embedAndUpsert error:', err));
    res.status(201).json({ id: docRef.id, success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create coupon' });
  }
});

router.put('/coupons/:id', async (req: AuthRequest, res: Response) => {
  try {
    const docId = req.params.id;
    const cleanFields = filterCouponFields(req.body);
    const data = { ...cleanFields, updatedAt: new Date().toISOString() };
    await adminDb.collection('coupons').doc(docId).update(data);
    (kb as any).embedAndUpsert('coupons', docId, data).catch((err: any) => console.error('[Admin] embedAndUpsert error:', err));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update coupon' });
  }
});

router.delete('/coupons/:id', async (req: AuthRequest, res: Response) => {
  try {
    const docId = req.params.id;
    await adminDb.collection('coupons').doc(docId).delete();
    (kb as any).deleteEmbedding('coupons', docId).catch((err: any) => console.error('[Admin] deleteEmbedding error:', err));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete coupon' });
  }
});

// ─── Combos / Offers ────────────────────────────────────────────────────────
router.post('/combos', async (req: AuthRequest, res: Response) => {
  try {
    const cleanFields = filterComboFields(req.body);
    const data = { ...cleanFields, createdAt: new Date().toISOString() };
    const docRef = await adminDb.collection('combos').add(data);
    (kb as any).embedAndUpsert('combos', docRef.id, data).catch((err: any) => console.error('[Admin] embedAndUpsert error:', err));
    res.status(201).json({ id: docRef.id, success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create combo' });
  }
});

router.put('/combos/:id', async (req: AuthRequest, res: Response) => {
  try {
    const docId = req.params.id;
    const cleanFields = filterComboFields(req.body);
    const data = { ...cleanFields, updatedAt: new Date().toISOString() };
    await adminDb.collection('combos').doc(docId).update(data);
    (kb as any).embedAndUpsert('combos', docId, data).catch((err: any) => console.error('[Admin] embedAndUpsert error:', err));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update combo' });
  }
});

router.delete('/combos/:id', async (req: AuthRequest, res: Response) => {
  try {
    const docId = req.params.id;
    await adminDb.collection('combos').doc(docId).delete();
    (kb as any).deleteEmbedding('combos', docId).catch((err: any) => console.error('[Admin] deleteEmbedding error:', err));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete combo' });
  }
});

// ─── Settings ───────────────────────────────────────────────────────────────
router.put('/settings/:id', async (req: AuthRequest, res: Response) => {
  try {
    const settingId = req.params.id;
    if (!/^[a-zA-Z0-9_-]+$/.test(settingId)) {
      res.status(400).json({ error: 'Invalid settings document key' });
      return;
    }
    const updateData = {
      ...req.body,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.uid || 'admin'
    };
    await adminDb.collection('settings').doc(settingId).set(updateData, { merge: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ─── Operational Account Verification & Approvals (Owner Console) ────────────
router.get('/accounts/pending', async (req: AuthRequest, res: Response) => {
  try {
    const pendingList: any[] = [];
    const seenUids = new Set<string>();

    // 1. Restaurant Managers
    try {
      const snap = await adminDb.collection('restaurant_managers')
        .where('status', 'in', ['PENDING_OWNER_APPROVAL', 'PENDING'])
        .get();
      for (const d of snap.docs) {
        const data = d.data();
        const uid = data.uid || d.id;
        if (!seenUids.has(uid)) {
          seenUids.add(uid);
          pendingList.push({
            id: d.id,
            uid,
            name: data.name || data.displayName || 'Restaurant Manager',
            email: data.email || '',
            phone: data.phone || '',
            role: 'restaurant_manager',
            targetApp: 'RESTAURANT_MANAGER',
            appLabel: 'Restaurant Management',
            franchiseId: data.franchiseId || '',
            branchId: data.branchId || '',
            branchName: data.branchName || '',
            status: data.status || 'PENDING_OWNER_APPROVAL',
            createdAt: data.createdAt || new Date().toISOString(),
            invitedBy: data.invitedBy || 'System'
          });
        }
      }
    } catch (err: any) {
      console.warn('[AdminAccounts] Error querying pending restaurant managers:', err.message);
    }

    // 2. POS Accounts
    try {
      const snap = await adminDb.collection('pos_accounts')
        .where('status', 'in', ['PENDING_OWNER_APPROVAL', 'PENDING'])
        .get();
      for (const d of snap.docs) {
        const data = d.data();
        const uid = data.uid || d.id;
        if (!seenUids.has(uid)) {
          seenUids.add(uid);
          pendingList.push({
            id: d.id,
            uid,
            name: data.cashierName || data.name || 'POS Operator',
            email: data.email || '',
            phone: data.phone || '',
            role: 'pos_operator',
            targetApp: 'POS',
            appLabel: 'POS Terminal',
            franchiseId: data.franchiseId || '',
            branchId: data.branchId || '',
            branchName: data.branchName || '',
            terminalId: data.terminalId || d.id,
            status: data.status || 'PENDING_OWNER_APPROVAL',
            createdAt: data.createdAt || new Date().toISOString()
          });
        }
      }
    } catch (err: any) {
      console.warn('[AdminAccounts] Error querying pending pos accounts:', err.message);
    }

    // 3. Franchise Users
    try {
      const snap = await adminDb.collection('franchise_users')
        .where('status', 'in', ['PENDING_OWNER_APPROVAL', 'PENDING'])
        .get();
      for (const d of snap.docs) {
        const data = d.data();
        const uid = data.uid || d.id;
        if (!seenUids.has(uid)) {
          seenUids.add(uid);
          pendingList.push({
            id: d.id,
            uid,
            name: data.name || data.displayName || 'Franchise Manager',
            email: data.email || '',
            phone: data.phone || '',
            role: 'franchise_manager',
            targetApp: 'FRANCHISE_MANAGER',
            appLabel: 'Franchise Management',
            franchiseId: data.franchiseId || '',
            branchId: data.branchId || '',
            branchName: data.branchName || '',
            status: data.status || 'PENDING_OWNER_APPROVAL',
            createdAt: data.createdAt || new Date().toISOString()
          });
        }
      }
    } catch (err: any) {
      console.warn('[AdminAccounts] Error querying pending franchise users:', err.message);
    }

    // 4. Delivery Partners
    try {
      const snap = await adminDb.collection('delivery_partners')
        .where('status', 'in', ['PENDING_OWNER_APPROVAL', 'PENDING'])
        .get();
      for (const d of snap.docs) {
        const data = d.data();
        const uid = data.uid || d.id;
        if (!seenUids.has(uid)) {
          seenUids.add(uid);
          pendingList.push({
            id: d.id,
            uid,
            name: data.name || 'Delivery Partner',
            email: data.email || '',
            phone: data.phone || '',
            role: 'delivery_partner',
            targetApp: 'DELIVERY',
            appLabel: 'Delivery Rider',
            franchiseId: data.franchiseId || '',
            branchId: data.branchId || '',
            branchName: data.branchName || '',
            status: data.status || 'PENDING_OWNER_APPROVAL',
            createdAt: data.createdAt || new Date().toISOString()
          });
        }
      }
    } catch (err: any) {
      console.warn('[AdminAccounts] Error querying pending delivery partners:', err.message);
    }

    // 5. Users collection fallback for any pending accounts
    try {
      const snap = await adminDb.collection('users')
        .where('status', 'in', ['PENDING_OWNER_APPROVAL', 'PENDING'])
        .get();
      for (const d of snap.docs) {
        const data = d.data();
        const uid = d.id;
        if (!seenUids.has(uid)) {
          seenUids.add(uid);
          const role = data.role || 'pending_staff';
          const targetApp = role === 'restaurant_manager' ? 'RESTAURANT_MANAGER' :
                            role === 'pos_operator' ? 'POS' :
                            role === 'franchise_manager' ? 'FRANCHISE_MANAGER' :
                            role === 'delivery_partner' ? 'DELIVERY' : 'OPERATIONAL';
          pendingList.push({
            id: d.id,
            uid,
            name: data.name || data.displayName || 'Staff Member',
            email: data.email || '',
            phone: data.phone || '',
            role,
            targetApp,
            appLabel: role.replace('_', ' ').toUpperCase(),
            franchiseId: data.franchiseId || '',
            branchId: data.branchId || '',
            status: data.status || 'PENDING_OWNER_APPROVAL',
            createdAt: data.createdAt || new Date().toISOString()
          });
        }
      }
    } catch (err: any) {
      console.warn('[AdminAccounts] Error querying pending users:', err.message);
    }

    res.json({ success: true, count: pendingList.length, pending: pendingList });
  } catch (error: any) {
    console.error('[AdminAccounts] Error fetching pending accounts:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch pending accounts' });
  }
});

// GET /accounts - List all operational accounts
router.get('/accounts', async (req: AuthRequest, res: Response) => {
  try {
    const accounts: any[] = [];
    const seenUids = new Set<string>();

    // 1. Restaurant Managers
    const mgrSnap = await adminDb.collection('restaurant_managers').get().catch(() => ({ docs: [] } as any));
    for (const d of mgrSnap.docs) {
      const data = d.data();
      const uid = data.uid || d.id;
      if (!seenUids.has(uid)) {
        seenUids.add(uid);
        accounts.push({
          id: d.id,
          uid,
          name: data.name || data.displayName || 'Restaurant Manager',
          email: data.email || '',
          phone: data.phone || '',
          role: 'restaurant_manager',
          targetApp: 'RESTAURANT_MANAGER',
          appLabel: 'Restaurant Management',
          franchiseId: data.franchiseId || '',
          branchId: data.branchId || '',
          branchName: data.branchName || '',
          status: data.status || (data.isActive !== false ? 'APPROVED' : 'DISABLED'),
          isActive: data.isActive !== false && data.status !== 'REJECTED' && data.status !== 'DEACTIVATED',
          createdAt: data.createdAt || '',
          approvedAt: data.approvedAt || ''
        });
      }
    }

    // 2. POS Accounts
    const posSnap = await adminDb.collection('pos_accounts').get().catch(() => ({ docs: [] } as any));
    for (const d of posSnap.docs) {
      const data = d.data();
      const uid = data.uid || d.id;
      if (!seenUids.has(uid)) {
        seenUids.add(uid);
        accounts.push({
          id: d.id,
          uid,
          name: data.cashierName || data.name || 'POS Operator',
          email: data.email || '',
          phone: data.phone || '',
          role: 'pos_operator',
          targetApp: 'POS',
          appLabel: 'POS Terminal',
          franchiseId: data.franchiseId || '',
          branchId: data.branchId || '',
          terminalId: data.terminalId || d.id,
          status: data.status || (data.isActive !== false ? 'APPROVED' : 'DISABLED'),
          isActive: data.isActive !== false && data.status !== 'REJECTED' && data.status !== 'REVOKED',
          createdAt: data.createdAt || '',
          approvedAt: data.approvedAt || ''
        });
      }
    }

    // 3. Franchise Users
    const fraSnap = await adminDb.collection('franchise_users').get().catch(() => ({ docs: [] } as any));
    for (const d of fraSnap.docs) {
      const data = d.data();
      const uid = data.uid || d.id;
      if (!seenUids.has(uid)) {
        seenUids.add(uid);
        accounts.push({
          id: d.id,
          uid,
          name: data.name || data.displayName || 'Franchise Manager',
          email: data.email || '',
          phone: data.phone || '',
          role: 'franchise_manager',
          targetApp: 'FRANCHISE_MANAGER',
          appLabel: 'Franchise Management',
          franchiseId: data.franchiseId || '',
          branchId: data.branchId || '',
          status: data.status || (data.isActive !== false ? 'APPROVED' : 'DISABLED'),
          isActive: data.isActive !== false && data.status !== 'REJECTED',
          createdAt: data.createdAt || '',
          approvedAt: data.approvedAt || ''
        });
      }
    }

    // 4. Delivery Partners
    const delSnap = await adminDb.collection('delivery_partners').get().catch(() => ({ docs: [] } as any));
    for (const d of delSnap.docs) {
      const data = d.data();
      const uid = data.uid || d.id;
      if (!seenUids.has(uid)) {
        seenUids.add(uid);
        accounts.push({
          id: d.id,
          uid,
          name: data.name || 'Delivery Partner',
          email: data.email || '',
          phone: data.phone || '',
          role: 'delivery_partner',
          targetApp: 'DELIVERY',
          appLabel: 'Delivery Rider',
          franchiseId: data.franchiseId || '',
          branchId: data.branchId || '',
          status: data.status || (data.isActive !== false ? 'APPROVED' : 'DISABLED'),
          isActive: data.isActive !== false && data.status !== 'REJECTED' && data.status !== 'BLOCKED',
          createdAt: data.createdAt || '',
          approvedAt: data.approvedAt || ''
        });
      }
    }

    res.json({ success: true, count: accounts.length, accounts });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to list accounts' });
  }
});

// POST /accounts/approve - Owner Approves an Account
router.post('/accounts/approve', async (req: AuthRequest, res: Response) => {
  try {
    const { uid, email, role, targetApp, franchiseId, branchId, permissions } = req.body;
    if (!uid && !email) {
      res.status(400).json({ error: 'User UID or email is required' });
      return;
    }

    const cleanEmail = (email || '').toLowerCase().trim();

    // 0. Locate existing account record to prevent arbitrary privilege escalation
    let existingDoc: any = null;
    let existingCollection = 'users';

    if (uid) {
      const uDoc = await adminDb.collection('users').doc(uid).get();
      if (uDoc.exists) {
        existingDoc = uDoc;
        existingCollection = 'users';
      }
    }
    if (!existingDoc && cleanEmail) {
      const q = await adminDb.collection('users').where('email', '==', cleanEmail).limit(1).get();
      if (!q.empty) {
        existingDoc = q.docs[0];
        existingCollection = 'users';
      }
    }

    // Check specific operational pending collections if not in users
    if (!existingDoc && uid) {
      for (const coll of ['restaurant_managers', 'pos_accounts', 'franchise_users', 'delivery_partners']) {
        const doc = await adminDb.collection(coll).doc(uid).get();
        if (doc.exists) {
          existingDoc = doc;
          existingCollection = coll;
          break;
        }
      }
    }

    const existingData = existingDoc?.data() || {};

    // Prevent privilege escalation: Cannot grant owner or developer via general approval
    const requestedRole = (role || existingData.role || '').toLowerCase();
    if (requestedRole === 'owner' || requestedRole === 'developer' || requestedRole === 'platform_owner') {
      res.status(403).json({ error: 'Forbidden: Owner and Developer privileges cannot be granted through operational account approval.' });
      return;
    }

    const now = new Date().toISOString();
    const resolvedRole = role || existingData.role || (
      targetApp === 'RESTAURANT_MANAGER' ? 'restaurant_manager' :
      targetApp === 'POS' ? 'pos_operator' :
      targetApp === 'FRANCHISE_MANAGER' ? 'franchise_manager' :
      targetApp === 'DELIVERY' ? 'delivery_partner' : 'restaurant_manager'
    );

    const effectiveFranchiseId = franchiseId || existingData.franchiseId || null;
    const effectiveBranchId = branchId || existingData.branchId || null;

    const updatePayload: Record<string, any> = {
      role: resolvedRole,
      status: 'APPROVED',
      isActive: true,
      approvedAt: now,
      approvedByUid: req.user?.uid || 'owner',
      approvedByEmail: req.user?.email || 'owner@olivepizza.in',
      updatedAt: now,
      franchiseId: effectiveFranchiseId,
      branchId: effectiveBranchId
    };

    if (permissions && Array.isArray(permissions)) {
      updatePayload.permissions = permissions;
    } else if (existingData.permissions) {
      updatePayload.permissions = existingData.permissions;
    }

    // 1. Update users collection
    if (uid) {
      await adminDb.collection('users').doc(uid).set(updatePayload, { merge: true });
    } else if (cleanEmail) {
      const q = await adminDb.collection('users').where('email', '==', cleanEmail).limit(1).get();
      if (!q.empty) {
        await q.docs[0].ref.set(updatePayload, { merge: true });
      }
    }

    // 2. Update specific operational collection
    const resolvedApp = targetApp || (
      resolvedRole === 'restaurant_manager' ? 'RESTAURANT_MANAGER' :
      resolvedRole === 'pos_operator' ? 'POS' :
      resolvedRole === 'franchise_manager' ? 'FRANCHISE_MANAGER' :
      resolvedRole === 'delivery_partner' ? 'DELIVERY' : ''
    );

    if (resolvedApp === 'RESTAURANT_MANAGER') {
      if (uid) await adminDb.collection('restaurant_managers').doc(uid).set(updatePayload, { merge: true });
      if (cleanEmail) {
        const mgrSnap = await adminDb.collection('restaurant_managers').where('email', '==', cleanEmail).limit(1).get();
        if (!mgrSnap.empty) await mgrSnap.docs[0].ref.set(updatePayload, { merge: true });
      }
    } else if (resolvedApp === 'POS') {
      if (uid) await adminDb.collection('pos_accounts').doc(uid).set(updatePayload, { merge: true });
      if (cleanEmail) {
        const posSnap = await adminDb.collection('pos_accounts').where('email', '==', cleanEmail).limit(1).get();
        if (!posSnap.empty) await posSnap.docs[0].ref.set(updatePayload, { merge: true });
      }
    } else if (resolvedApp === 'FRANCHISE_MANAGER') {
      if (uid) await adminDb.collection('franchise_users').doc(uid).set(updatePayload, { merge: true });
      if (cleanEmail) {
        const fraSnap = await adminDb.collection('franchise_users').where('email', '==', cleanEmail).limit(1).get();
        if (!fraSnap.empty) await fraSnap.docs[0].ref.set(updatePayload, { merge: true });
      }
    } else if (resolvedApp === 'DELIVERY') {
      if (uid) {
        await adminDb.collection('delivery_partners').doc(uid).set(updatePayload, { merge: true });
        await adminDb.collection('delivery_riders').doc(uid).set(updatePayload, { merge: true }).catch(() => {});
      }
      if (cleanEmail) {
        const delSnap = await adminDb.collection('delivery_partners').where('email', '==', cleanEmail).limit(1).get();
        if (!delSnap.empty) await delSnap.docs[0].ref.set(updatePayload, { merge: true });
      }
    }

    // 3. Set custom claims if UID is available — NO HARDCODED FALLBACKS
    if (uid && !uid.startsWith('mgr_') && !uid.startsWith('pos_')) {
      try {
        await adminAuth.setCustomUserClaims(uid, {
          role: resolvedRole,
          branchId: effectiveBranchId,
          franchiseId: effectiveFranchiseId,
          status: 'APPROVED'
        });
      } catch (claimsErr: any) {
        console.warn('[AdminAccounts] Custom claims warning on approve:', claimsErr.message);
      }
    }

    res.json({
      success: true,
      message: `Account approved successfully as ${resolvedRole}`,
      uid,
      role: resolvedRole,
      status: 'APPROVED'
    });
  } catch (error: any) {
    console.error('[AdminAccounts] Error approving account:', error);
    res.status(500).json({ error: error.message || 'Failed to approve account' });
  }
});

// POST /accounts/reject - Owner Rejects an Account
router.post('/accounts/reject', async (req: AuthRequest, res: Response) => {
  try {
    const { uid, email, targetApp, reason } = req.body;
    if (!uid && !email) {
      res.status(400).json({ error: 'User UID or email is required' });
      return;
    }

    const now = new Date().toISOString();
    const cleanEmail = (email || '').toLowerCase().trim();
    const rejectionData = {
      status: 'REJECTED',
      isActive: false,
      rejectionReason: reason || 'Application rejected by platform owner',
      rejectedAt: now,
      rejectedByUid: req.user?.uid || 'owner',
      rejectedByEmail: req.user?.email || 'owner@olivepizza.in',
      updatedAt: now
    };

    if (uid) {
      await adminDb.collection('users').doc(uid).set(rejectionData, { merge: true });
    } else if (cleanEmail) {
      const q = await adminDb.collection('users').where('email', '==', cleanEmail).limit(1).get();
      if (!q.empty) await q.docs[0].ref.set(rejectionData, { merge: true });
    }

    if (targetApp === 'RESTAURANT_MANAGER' || !targetApp) {
      if (uid) await adminDb.collection('restaurant_managers').doc(uid).set(rejectionData, { merge: true });
      if (cleanEmail) {
        const mgrSnap = await adminDb.collection('restaurant_managers').where('email', '==', cleanEmail).limit(1).get();
        if (!mgrSnap.empty) await mgrSnap.docs[0].ref.set(rejectionData, { merge: true });
      }
    }
    if (targetApp === 'POS' || !targetApp) {
      if (uid) await adminDb.collection('pos_accounts').doc(uid).set(rejectionData, { merge: true });
      if (cleanEmail) {
        const posSnap = await adminDb.collection('pos_accounts').where('email', '==', cleanEmail).limit(1).get();
        if (!posSnap.empty) await posSnap.docs[0].ref.set(rejectionData, { merge: true });
      }
    }
    if (targetApp === 'FRANCHISE_MANAGER' || !targetApp) {
      if (uid) await adminDb.collection('franchise_users').doc(uid).set(rejectionData, { merge: true });
      if (cleanEmail) {
        const fraSnap = await adminDb.collection('franchise_users').where('email', '==', cleanEmail).limit(1).get();
        if (!fraSnap.empty) await fraSnap.docs[0].ref.set(rejectionData, { merge: true });
      }
    }
    if (targetApp === 'DELIVERY' || !targetApp) {
      if (uid) await adminDb.collection('delivery_partners').doc(uid).set(rejectionData, { merge: true });
      if (cleanEmail) {
        const delSnap = await adminDb.collection('delivery_partners').where('email', '==', cleanEmail).limit(1).get();
        if (!delSnap.empty) await delSnap.docs[0].ref.set(rejectionData, { merge: true });
      }
    }

    res.json({
      success: true,
      message: 'Account request rejected',
      status: 'REJECTED'
    });
  } catch (error: any) {
    console.error('[AdminAccounts] Error rejecting account:', error);
    res.status(500).json({ error: error.message || 'Failed to reject account' });
  }
});

// POST /accounts/toggle-status - Owner Toggles Account Active / Inactive
router.post('/accounts/toggle-status', async (req: AuthRequest, res: Response) => {
  try {
    const { uid, email, targetApp, isActive } = req.body;
    if (!uid && !email) {
      res.status(400).json({ error: 'User UID or email is required' });
      return;
    }

    const now = new Date().toISOString();
    const cleanEmail = (email || '').toLowerCase().trim();
    const activeBool = Boolean(isActive);
    const updateData = {
      isActive: activeBool,
      status: activeBool ? 'APPROVED' : 'DISABLED',
      updatedAt: now,
      updatedByUid: req.user?.uid || 'owner',
      updatedByEmail: req.user?.email || 'owner@olivepizza.in'
    };

    if (uid) {
      await adminDb.collection('users').doc(uid).set(updateData, { merge: true });
      if (!activeBool && !uid.startsWith('mgr_') && !uid.startsWith('pos_')) {
        await adminAuth.revokeRefreshTokens(uid).catch(() => {});
      }
    } else if (cleanEmail) {
      const q = await adminDb.collection('users').where('email', '==', cleanEmail).limit(1).get();
      if (!q.empty) {
        await q.docs[0].ref.set(updateData, { merge: true });
        if (!activeBool) await adminAuth.revokeRefreshTokens(q.docs[0].id).catch(() => {});
      }
    }

    if (targetApp === 'RESTAURANT_MANAGER' || !targetApp) {
      if (uid) await adminDb.collection('restaurant_managers').doc(uid).set(updateData, { merge: true });
      if (cleanEmail) {
        const mgrSnap = await adminDb.collection('restaurant_managers').where('email', '==', cleanEmail).limit(1).get();
        if (!mgrSnap.empty) await mgrSnap.docs[0].ref.set(updateData, { merge: true });
      }
    }
    if (targetApp === 'POS' || !targetApp) {
      if (uid) await adminDb.collection('pos_accounts').doc(uid).set(updateData, { merge: true });
      if (cleanEmail) {
        const posSnap = await adminDb.collection('pos_accounts').where('email', '==', cleanEmail).limit(1).get();
        if (!posSnap.empty) await posSnap.docs[0].ref.set(updateData, { merge: true });
      }
    }
    if (targetApp === 'FRANCHISE_MANAGER' || !targetApp) {
      if (uid) await adminDb.collection('franchise_users').doc(uid).set(updateData, { merge: true });
      if (cleanEmail) {
        const fraSnap = await adminDb.collection('franchise_users').where('email', '==', cleanEmail).limit(1).get();
        if (!fraSnap.empty) await fraSnap.docs[0].ref.set(updateData, { merge: true });
      }
    }
    if (targetApp === 'DELIVERY' || !targetApp) {
      if (uid) await adminDb.collection('delivery_partners').doc(uid).set(updateData, { merge: true });
      if (cleanEmail) {
        const delSnap = await adminDb.collection('delivery_partners').where('email', '==', cleanEmail).limit(1).get();
        if (!delSnap.empty) await delSnap.docs[0].ref.set(updateData, { merge: true });
      }
    }

    res.json({
      success: true,
      message: `Account ${activeBool ? 'enabled' : 'disabled'} successfully`,
      isActive: activeBool,
      status: updateData.status
    });
  } catch (error: any) {
    console.error('[AdminAccounts] Error toggling account status:', error);
    res.status(500).json({ error: error.message || 'Failed to toggle account status' });
  }
});

export default router;

