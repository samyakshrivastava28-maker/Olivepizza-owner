import { Router, Response } from 'express';
import crypto from 'crypto';
import { adminDb, adminAuth } from '../config/firebase.js';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth.middleware.js';
import { FranchiseScopeService } from '../services/franchise/FranchiseScopeService.js';
import { FranchisePinService } from '../services/franchise/FranchisePinService.js';
import { FranchiseGoogleSheetsService } from '../services/reports/FranchiseGoogleSheetsService.js';
import { OrderProjectionService } from '../services/order/OrderProjectionService.js';

const router = Router();

const DEFAULT_ORGANIZATION = {
  id: 'org_olive_pizza',
  name: 'Olive Pizza India',
  legalName: 'Olive Pizza Foodworks Private Limited',
  contactEmail: 'olivepizzarjn@gmail.com',
  contactPhone: '+91 91799 44445',
  currency: 'INR',
  country: 'IN',
  createdAt: new Date().toISOString()
};

export interface FranchiseEntity {
  id: string;
  slug: string;
  organizationId: string;
  name: string;
  code: string;
  region: string;
  city: string;
  contactEmail: string;
  contactPhone: string;
  franchiseOwnerName?: string;
  franchiseOwnerEmail?: string;
  mainBranchId: string;
  isActive: boolean;
  status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  businessHours?: {
    openingTime: string;
    closingTime: string;
    isOpenToday: boolean;
  };
  deliverySettings?: {
    maxDeliveryRadiusKm: number;
    deliveryFee: number;
    freeDeliveryThreshold: number;
    minOrderAmount: number;
  };
  createdAt: string;
  updatedAt: string;
}

// ── No hardcoded default franchises or branches.
// Franchises and branches are created exclusively via the Provisioning Wizard
// (POST /api/franchises/provision) and stored in Firestore.
// The owner must use the wizard to create real franchises.

router.use(verifyToken);

// ─── 1. LIST ALL FRANCHISES (FOR GLOBAL OWNER OR FRANCHISE OWNER) ───────────
router.get('/list', requireRole(['owner', 'admin', 'developer', 'platform_owner', 'franchise_owner']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const scope = req.user?.scope || FranchiseScopeService.resolveScope(req.user);
    const snap = await adminDb.collection('franchise_entities').get();
    let franchises: FranchiseEntity[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as FranchiseEntity));

    // Filter if restricted franchise owner
    if (!scope.isGlobalOwner) {
      franchises = franchises.filter(f => f.id === scope.franchiseId || f.slug === scope.franchiseId);
    }

    // Augment with live branch and terminal counts
    const bSnap = await adminDb.collection('franchises').get().catch(() => ({ docs: [] } as any));
    const allBranches: any[] = bSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

    const posSnap = await adminDb.collection('pos_terminals').get().catch(() => ({ docs: [] } as any));
    const allTerminals: any[] = posSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

    const mgrSnap = await adminDb.collection('restaurant_managers').get().catch(() => ({ docs: [] } as any));
    const allMgrs: any[] = mgrSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

    const riderSnap = await adminDb.collection('delivery_partners').get().catch(() => ({ docs: [] } as any));
    const allRiders: any[] = riderSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

    const augmented = franchises.map(f => {
      const branches = allBranches.filter(b => b.franchiseId === f.id || (f.id === 'fra_rajnandgaon' && (b.id === 'main_branch' || b.franchiseId === 'fra_primary')));
      const branchIds = branches.map(b => b.id);
      const terminals = allTerminals.filter(t => t.franchiseId === f.id || branchIds.includes(t.branchId));
      const managers = allMgrs.filter(m => m.franchiseId === f.id || branchIds.includes(m.branchId));
      const riders = allRiders.filter(r => r.franchiseId === f.id || branchIds.includes(r.branchId));

      return {
        ...f,
        branchCount: branches.length,
        terminalCount: terminals.length,
        managerCount: managers.length,
        riderCount: riders.length,
        mainBranch: branches[0]?.name || null,
        mainBranchId: branches[0]?.id || f.mainBranchId,
      };
    });

    res.json({ success: true, franchises: augmented });
  } catch (error: any) {
    console.error('[FranchiseRoutes] Error listing franchises:', error);
    res.status(500).json({ error: 'Failed to list franchises' });
  }
});

// ─── 2. RESOLVE FRANCHISE BY SLUG (AUTHORITATIVE SERVER SCOPING) ───────────
router.get('/by-slug/:slug', requireRole(['owner', 'admin', 'developer', 'platform_owner', 'franchise_owner', 'restaurant_manager']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;
    const cleanSlug = slug.toLowerCase().trim();
    const scope = req.user?.scope || FranchiseScopeService.resolveScope(req.user);

    const snap = await adminDb.collection('franchise_entities').get();
    const franchise = snap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) } as FranchiseEntity))
      .find(f => f.slug === cleanSlug || f.id === cleanSlug || f.id === `fra_${cleanSlug}`);

    if (!franchise) {
      res.status(404).json({ error: `Franchise with slug '${cleanSlug}' not found`, code: 'NOT_FOUND' });
      return;
    }

    // Backend scope enforcement
    if (!scope.isGlobalOwner && scope.franchiseId !== franchise.id && scope.franchiseId !== franchise.slug) {
      res.status(403).json({ error: 'Unauthorized: You do not have permission to access this franchise', code: 'FORBIDDEN' });
      return;
    }

    // Fetch associated branches
    const bSnap = await adminDb.collection('franchises').get();
    const branches = bSnap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .filter(b => b.franchiseId === franchise.id || (franchise.id === 'fra_rajnandgaon' && (b.id === 'main_branch' || b.franchiseId === 'fra_primary')));

    res.json({
      success: true,
      franchise: {
        ...franchise,
        branches
      }
    });
  } catch (error: any) {
    console.error('[FranchiseRoutes] Error resolving franchise slug:', error);
    res.status(500).json({ error: 'Failed to resolve franchise' });
  }
});

// ─── 3. FRANCHISE DASHBOARD METRICS ─────────────────────────────────────────
router.get('/:id/dashboard', requireRole(['owner', 'admin', 'developer', 'platform_owner', 'franchise_owner', 'restaurant_manager']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const branchFilter = req.query.branchId as string;
    const scope = req.user?.scope || FranchiseScopeService.resolveScope(req.user);

    if (!scope.isGlobalOwner && scope.franchiseId !== id && scope.franchiseId !== `fra_${id}`) {
      res.status(403).json({ error: 'Unauthorized: Scope mismatch', code: 'FORBIDDEN' });
      return;
    }

    // Fetch branches for this franchise
    const bSnap = await adminDb.collection('franchises').get();
    const branches: any[] = bSnap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .filter(b => b.franchiseId === id || (id === 'fra_rajnandgaon' && (b.id === 'main_branch' || b.franchiseId === 'fra_primary')));

    const targetBranchIds = branchFilter && branchFilter !== 'all'
      ? [branchFilter]
      : (branches.length > 0 ? branches.map(b => b.id) : ['main_branch']);

    // Fetch orders for metrics
    const orderSnap = await adminDb.collection('orders').limit(300).get().catch(() => ({ docs: [] } as any));
    const allOrders: any[] = orderSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

    const scopedOrders = allOrders.filter(o => {
      const bId = o.branchId || 'main_branch';
      return targetBranchIds.includes(bId);
    });

    let todaySales = 0;
    let posSales = 0;
    let onlineSales = 0;
    let activeOrdersCount = 0;
    let completedOrdersCount = 0;
    let cancelledOrdersCount = 0;
    let cashSales = 0;
    let upiSales = 0;
    let cardSales = 0;
    let dineInCount = 0;
    let takeawayCount = 0;
    let deliveryCount = 0;

    scopedOrders.forEach(o => {
      const amt = Number(o.totalAmount || 0);
      const status = (o.status || 'pending').toLowerCase();
      const source = (o.orderSource || 'website').toLowerCase();
      const pMethod = (o.paymentMethod || 'online').toLowerCase();
      const fType = (o.fulfillmentType || o.deliveryType || 'delivery').toLowerCase();

      if (status !== 'cancelled' && status !== 'rejected') {
        todaySales += amt;
        if (source === 'pos') posSales += amt;
        else onlineSales += amt;

        if (pMethod === 'cash') cashSales += amt;
        else if (pMethod === 'upi') upiSales += amt;
        else cardSales += amt;

        if (fType.includes('dine')) dineInCount++;
        else if (fType.includes('take')) takeawayCount++;
        else deliveryCount++;
      }

      if (['pending', 'accepted', 'preparing', 'partner_assigned', 'ready', 'picked_up', 'out_for_delivery'].includes(status)) {
        activeOrdersCount++;
      } else if (status === 'delivered' || status === 'completed') {
        completedOrdersCount++;
      } else if (status === 'cancelled' || status === 'rejected') {
        cancelledOrdersCount++;
      }
    });

    // POS & Rider counts
    const posSnap = await adminDb.collection('pos_terminals').get().catch(() => ({ docs: [] } as any));
    const activeTerminals: any[] = posSnap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .filter(t => targetBranchIds.includes(t.branchId) && t.isActive !== false);

    const riderSnap = await adminDb.collection('delivery_partners').get().catch(() => ({ docs: [] } as any));
    const activeRiders: any[] = riderSnap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .filter(r => (r.franchiseId === id || targetBranchIds.includes(r.branchId)) && r.isActive !== false);

    res.json({
      success: true,
      dashboard: {
        franchiseId: id,
        branchCount: targetBranchIds.length,
        todaySales,
        totalOrders: scopedOrders.length,
        activeOrders: activeOrdersCount,
        completedOrders: completedOrdersCount,
        cancelledOrders: cancelledOrdersCount,
        avgOrderValue: scopedOrders.length > 0 ? Math.round(todaySales / Math.max(1, scopedOrders.length)) : 0,
        posSales,
        onlineSales,
        cashSales,
        upiSales,
        cardSales,
        dineInCount,
        takeawayCount,
        deliveryCount,
        activeBranchesCount: targetBranchIds.length,
        activePosTerminalsCount: activeTerminals.length,
        activeRidersCount: activeRiders.length,
        lowStockAlertsCount: 0,
        operationalAlertsCount: 0,
        syncTimestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('[FranchiseRoutes] Error loading dashboard:', error);
    res.status(500).json({ error: 'Failed to load franchise dashboard' });
  }
});

// ─── 4. FRANCHISE-SCOPED BRANCHES (GET / POST / PATCH) ───────────────────────
router.get('/:id/branches', requireRole(['owner', 'admin', 'developer', 'platform_owner', 'franchise_owner', 'restaurant_manager']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const bSnap = await adminDb.collection('franchises').get();
    const branches: any[] = bSnap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .filter(b => b.franchiseId === id || (id === 'fra_rajnandgaon' && (b.id === 'main_branch' || b.franchiseId === 'fra_primary')));

    res.json({ success: true, branches });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to list franchise branches' });
  }
});

router.post('/:id/branches', requireRole(['owner', 'admin', 'developer', 'platform_owner']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, code, city, state, address, lat, lng, phone, email, maxDeliveryRadiusKm, openingTime, closingTime } = req.body;

    if (!name || !city) {
      res.status(400).json({ error: 'Branch name and city are required' });
      return;
    }

    const branchId = code 
      ? code.toLowerCase().replace(/[^a-z0-9]/g, '_') 
      : `${city.toLowerCase().replace(/[^a-z0-9]/g, '_')}_branch_${Date.now().toString().slice(-4)}`;

    const branchData = {
      id: branchId,
      franchiseId: id,
      organizationId: FranchiseScopeService.DEFAULT_ORG_ID,
      name: name.trim(),
      code: code ? code.trim().toUpperCase() : `OP-${city.slice(0, 3).toUpperCase()}-02`,
      city: city.trim(),
      state: state ? state.trim() : 'Chhattisgarh',
      address: address ? address.trim() : `${city}, Chhattisgarh`,
      lat: Number(lat) || 21.0810244,
      lng: Number(lng) || 81.0123793,
      phone: phone || '+91 91799 44445',
      email: email || `branch.${branchId}@olivepizza.in`,
      maxDeliveryRadiusKm: Number(maxDeliveryRadiusKm) || 12,
      openingTime: openingTime || '12:00',
      closingTime: closingTime || '23:59',
      isActive: true,
      isHeadquarters: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: req.user?.uid || 'owner'
    };

    await adminDb.collection('franchises').doc(branchId).set(branchData, { merge: true });

    await FranchiseScopeService.logFranchiseAudit({
      organizationId: branchData.organizationId,
      franchiseId: id,
      branchId: branchData.id,
      actorUid: req.user?.uid || 'owner',
      actorEmail: req.user?.email || 'owner@olivepizza.in',
      actionType: 'BRANCH_CREATED',
      entityType: 'franchise_branch',
      entityId: branchId,
      details: branchData
    });

    res.status(201).json({ success: true, branch: branchData });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create branch' });
  }
});

// ─── 5. RESTAURANT MANAGERS SCOPED TO FRANCHISE ─────────────────────────────
router.get('/:id/managers', requireRole(['owner', 'admin', 'developer', 'platform_owner', 'franchise_owner', 'franchise_manager']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const isOwner = FranchiseScopeService.isGlobalOwner(req.user?.email, req.user?.role);
    if (!isOwner && req.user?.franchiseId && req.user.franchiseId !== id) {
      res.status(403).json({ error: 'Cross-franchise access denied' });
      return;
    }

    const bSnap = await adminDb.collection('franchises').get();
    const branchIds = bSnap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .filter(b => b.franchiseId === id || (id === 'fra_rajnandgaon' && b.id === 'main_branch'))
      .map(b => b.id);

    const mgrSnap = await adminDb.collection('restaurant_managers').get();
    const managers: any[] = mgrSnap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .filter(m => m.franchiseId === id || branchIds.includes(m.branchId))
      .map(({ pinHash, ...safe }) => safe);

    res.json({ success: true, managers });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to list restaurant managers' });
  }
});

// GET /:id/restaurant-managers/pending - Owner Approval Queue
router.get('/:id/restaurant-managers/pending', requireRole(['owner', 'admin', 'developer', 'platform_owner']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const snap = await adminDb.collection('restaurant_managers').where('status', '==', 'PENDING_OWNER_APPROVAL').get();
    let pending = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    if (id !== 'all') {
      pending = pending.filter(m => m.franchiseId === id);
    }
    const safePending = pending.map(({ pinHash, ...safe }) => safe);
    res.json({ success: true, pending: safePending });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch pending managers' });
  }
});

// POST /:id/restaurant-managers/:managerId/approve - Owner Approves Restaurant Manager
router.post('/:id/restaurant-managers/:managerId/approve', requireRole(['owner', 'admin', 'developer', 'platform_owner']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, managerId } = req.params;
    const mgrRef = adminDb.collection('restaurant_managers').doc(managerId);
    const mgrDoc = await mgrRef.get();

    if (!mgrDoc.exists) {
      res.status(404).json({ error: 'Restaurant Manager record not found' });
      return;
    }

    const now = new Date().toISOString();
    await mgrRef.set({
      status: 'APPROVED',
      approvedAt: now,
      approvedByUid: req.user?.uid || 'owner',
      approvedByEmail: req.user?.email || 'owner@olivepizza.in',
      updatedAt: now
    }, { merge: true });

    // Also update users collection if exists
    const uid = mgrDoc.data()?.uid || managerId;
    await adminDb.collection('users').doc(uid).set({
      role: 'restaurant_manager',
      status: 'APPROVED',
      isActive: true,
      updatedAt: now
    }, { merge: true }).catch(() => {});

    await FranchiseScopeService.logFranchiseAudit({
      franchiseId: id,
      actorUid: req.user?.uid || 'owner',
      actorEmail: req.user?.email || 'owner@olivepizza.in',
      actionType: 'RESTAURANT_MANAGER_APPROVED',
      entityType: 'restaurant_manager',
      entityId: managerId,
      details: { managerId, email: mgrDoc.data()?.email }
    });

    res.json({ success: true, message: 'Restaurant Manager approved successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to approve restaurant manager' });
  }
});

// POST /:id/restaurant-managers/:managerId/reject - Owner Rejects Restaurant Manager
router.post('/:id/restaurant-managers/:managerId/reject', requireRole(['owner', 'admin', 'developer', 'platform_owner']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, managerId } = req.params;
    const { reason } = req.body;
    const mgrRef = adminDb.collection('restaurant_managers').doc(managerId);
    const mgrDoc = await mgrRef.get();

    if (!mgrDoc.exists) {
      res.status(404).json({ error: 'Restaurant Manager record not found' });
      return;
    }

    const now = new Date().toISOString();
    await mgrRef.set({
      status: 'REJECTED',
      rejectionReason: reason || 'Application rejected by platform owner',
      rejectedAt: now,
      rejectedByUid: req.user?.uid || 'owner',
      rejectedByEmail: req.user?.email || 'owner@olivepizza.in',
      updatedAt: now
    }, { merge: true });

    await FranchiseScopeService.logFranchiseAudit({
      franchiseId: id,
      actorUid: req.user?.uid || 'owner',
      actorEmail: req.user?.email || 'owner@olivepizza.in',
      actionType: 'RESTAURANT_MANAGER_REJECTED',
      entityType: 'restaurant_manager',
      entityId: managerId,
      details: { managerId, reason }
    });

    res.json({ success: true, message: 'Restaurant Manager request rejected' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to reject restaurant manager' });
  }
});

// POST /:id/managers - Provision Restaurant Manager (Max 1 per franchise)
router.post('/:id/managers', requireRole(['owner', 'admin', 'developer', 'platform_owner', 'franchise_manager']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const isOwner = FranchiseScopeService.isGlobalOwner(req.user?.email, req.user?.role);
    if (!isOwner && req.user?.franchiseId && req.user.franchiseId !== id) {
      res.status(403).json({ error: 'Cross-franchise access denied' });
      return;
    }

    const { name, email, phone, branchId, permissions, pin } = req.body;

    if (!name || !email) {
      res.status(400).json({ error: 'Manager name and email are required' });
      return;
    }

    if (!pin || !/^\d{4}$/.test(String(pin).trim())) {
      res.status(400).json({ error: 'A 4-digit PIN is strictly required' });
      return;
    }

    let pinHash: string;
    try {
      pinHash = await FranchisePinService.hashPin(String(pin).trim());
    } catch (pinErr: any) {
      res.status(400).json({ error: pinErr.message || 'Invalid PIN' });
      return;
    }

    // Atomic Uniqueness Constraint: Max 1 active/pending Restaurant Manager account per franchise
    const existingMgrsSnap = await adminDb.collection('restaurant_managers')
      .where('franchiseId', '==', id)
      .get();
    const existingActive = existingMgrsSnap.docs.filter(d => {
      const data = d.data();
      return data.isActive !== false && ['APPROVED', 'PENDING_OWNER_APPROVAL'].includes(data.status || 'APPROVED');
    });

    if (existingActive.length > 0) {
      res.status(409).json({
        error: 'A Restaurant Manager account already exists for this franchise. Maximum 1 account permitted.',
        code: 'LIMIT_EXCEEDED'
      });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const mgrId = `mgr_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
    const now = new Date().toISOString();

    let targetUid = mgrId;
    try {
      const existingAuth = await adminAuth.getUserByEmail(cleanEmail);
      targetUid = existingAuth.uid;
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        const secureRandomPassword = crypto.randomBytes(12).toString('base64url') + '!OP9';
        const createdAuth = await adminAuth.createUser({
          email: cleanEmail,
          password: secureRandomPassword,
          displayName: name.trim()
        });
        targetUid = createdAuth.uid;
      }
    }

    const initialStatus = isOwner ? 'APPROVED' : 'PENDING_OWNER_APPROVAL';

    const managerData: Record<string, any> = {
      id: mgrId,
      uid: targetUid,
      name: name.trim(),
      email: cleanEmail,
      phone: phone || '',
      role: 'restaurant_manager',
      status: initialStatus,
      organizationId: FranchiseScopeService.DEFAULT_ORG_ID,
      franchiseId: id,
      branchId: branchId || 'main_branch',
      permissions: permissions || ['dashboard.view', 'orders.live', 'orders.history', 'inventory.view', 'notifications.send'],
      isActive: true,
      hasPin: true,
      pinHash,
      failedPinAttempts: 0,
      createdAt: now,
      updatedAt: now,
      invitedBy: req.user?.uid || 'franchise_manager',
      invitedByEmail: req.user?.email || 'manager@olivepizza.in'
    };

    await adminDb.collection('restaurant_managers').doc(mgrId).set(managerData, { merge: true });
    if (targetUid !== mgrId) {
      await adminDb.collection('restaurant_managers').doc(targetUid).set(managerData, { merge: true });
    }

    await adminDb.collection('users').doc(targetUid).set({
      uid: targetUid,
      name: managerData.name,
      email: cleanEmail,
      role: 'restaurant_manager',
      status: initialStatus,
      franchiseId: id,
      branchId: managerData.branchId,
      isActive: true,
      updatedAt: now
    }, { merge: true }).catch(() => {});

    await FranchiseScopeService.logFranchiseAudit({
      organizationId: managerData.organizationId,
      franchiseId: id,
      branchId: managerData.branchId,
      actorUid: req.user?.uid || 'franchise_manager',
      actorEmail: req.user?.email || 'manager@olivepizza.in',
      actionType: 'MANAGER_PROVISIONED',
      entityType: 'restaurant_manager',
      entityId: mgrId,
      details: { name: managerData.name, email: cleanEmail, status: initialStatus, branchId: managerData.branchId }
    });

    const { pinHash: _omitted, ...safeManagerData } = managerData;
    res.status(201).json({ success: true, manager: safeManagerData });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to provision restaurant manager' });
  }
});

// ─── 5.1 SET / UPDATE MANAGER PIN (POST /:id/managers/:managerId/set-pin) ──
router.post('/:id/managers/:managerId/set-pin', requireRole(['owner', 'admin', 'developer', 'platform_owner', 'franchise_owner']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, managerId } = req.params;
    const { pin } = req.body;

    if (!pin) {
      res.status(400).json({ success: false, error: 'PIN is required' });
      return;
    }

    let pinHash: string;
    try {
      pinHash = await FranchisePinService.hashPin(pin);
    } catch (pinErr: any) {
      res.status(400).json({ success: false, error: pinErr.message || 'Invalid PIN' });
      return;
    }

    const now = new Date().toISOString();
    const pinPayload = {
      pinHash,
      hasPin: true,
      failedPinAttempts: 0,
      pinLockedUntil: null,
      pinUpdatedAt: now,
      updatedAt: now,
      updatedBy: req.user?.email || 'owner'
    };

    // Update in restaurant_managers
    const mgrRef = adminDb.collection('restaurant_managers').doc(managerId);
    const mgrDoc = await mgrRef.get();
    if (mgrDoc.exists) {
      await mgrRef.set(pinPayload, { merge: true });
    }

    // Update in franchise_users
    const fuRef = adminDb.collection('franchise_users').doc(managerId);
    const fuDoc = await fuRef.get();
    if (fuDoc.exists) {
      await fuRef.set(pinPayload, { merge: true });
    }

    // Update in users collection if exists
    const uRef = adminDb.collection('users').doc(managerId);
    const uDoc = await uRef.get();
    if (uDoc.exists) {
      await uRef.set(pinPayload, { merge: true });
    }

    await FranchiseScopeService.logFranchiseAudit({
      franchiseId: id,
      actorUid: req.user?.uid || 'owner',
      actorEmail: req.user?.email || 'owner@olivepizza.in',
      actionType: 'MANAGER_PIN_SET',
      entityType: 'restaurant_manager',
      entityId: managerId,
      details: { managerId, updatedBy: req.user?.email }
    });

    res.json({ success: true, message: 'Manager PIN updated successfully' });
  } catch (error: any) {
    console.error('[FranchiseRoutes] Error setting manager PIN:', error);
    res.status(500).json({ success: false, error: 'Failed to set manager PIN' });
  }
});

// ─── 5.2 SERVER-SIDE PIN VERIFICATION (POST /verify-pin) ────────────────────
router.post('/verify-pin', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { pin } = req.body;
    const uid = req.user?.uid;
    const email = req.user?.email;

    if (!pin) {
      res.status(400).json({ success: false, error: 'PIN is required' });
      return;
    }

    if (!uid) {
      res.status(401).json({ success: false, error: 'User must be authenticated' });
      return;
    }

    // Lookup user record in Firestore (restaurant_managers, franchise_users, or users)
    let userDoc = await adminDb.collection('franchise_users').doc(uid).get();
    let collectionName = 'franchise_users';

    if (!userDoc.exists) {
      userDoc = await adminDb.collection('restaurant_managers').doc(uid).get();
      collectionName = 'restaurant_managers';
    }
    if (!userDoc.exists) {
      userDoc = await adminDb.collection('users').doc(uid).get();
      collectionName = 'users';
    }

    // Also check query by email if not found by UID
    if (!userDoc.exists && email) {
      const qSnap = await adminDb.collection('restaurant_managers').where('email', '==', email.toLowerCase()).limit(1).get();
      if (!qSnap.empty) {
        userDoc = qSnap.docs[0];
        collectionName = 'restaurant_managers';
      }
    }

    if (!userDoc.exists) {
      res.status(404).json({ success: false, error: 'Manager account record not found' });
      return;
    }

    const userData = userDoc.data() as any;
    const pinHash = userData?.pinHash;
    const failedAttempts = userData?.failedPinAttempts || 0;
    const lockedUntil = userData?.pinLockedUntil;

    // Check account lockout
    if (FranchisePinService.isAccountLocked(failedAttempts, lockedUntil)) {
      const remainingMinutes = Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / (60 * 1000));
      res.status(423).json({
        success: false,
        isLocked: true,
        error: `Account is locked due to too many failed PIN attempts. Try again in ${remainingMinutes} minute(s).`
      });
      return;
    }

    if (!pinHash) {
      res.status(400).json({
        success: false,
        requiresPinSetup: true,
        error: 'No PIN has been configured for this account. Please ask the franchise owner to set your PIN.'
      });
      return;
    }

    // Constant-time bcrypt verify
    const isMatch = await FranchisePinService.verifyPin(pin.trim(), pinHash);

    if (!isMatch) {
      const nextAttempts = failedAttempts + 1;
      const isNowLocked = nextAttempts >= FranchisePinService.MAX_ATTEMPTS;
      const lockExpiry = isNowLocked ? FranchisePinService.getLockoutExpiry() : null;

      await adminDb.collection(collectionName).doc(userDoc.id).set({
        failedPinAttempts: nextAttempts,
        pinLockedUntil: lockExpiry,
        lastFailedPinAt: new Date().toISOString()
      }, { merge: true });

      if (isNowLocked) {
        res.status(423).json({
          success: false,
          isLocked: true,
          error: `Too many failed attempts. Account locked for ${FranchisePinService.LOCKOUT_MINUTES} minutes.`
        });
        return;
      }

      res.status(401).json({
        success: false,
        error: 'Incorrect PIN',
        attemptsRemaining: FranchisePinService.MAX_ATTEMPTS - nextAttempts
      });
      return;
    }

    // Success — reset failed counter
    await adminDb.collection(collectionName).doc(userDoc.id).set({
      failedPinAttempts: 0,
      pinLockedUntil: null,
      lastSuccessfulPinAt: new Date().toISOString()
    }, { merge: true });

    res.json({
      success: true,
      message: 'PIN verified successfully',
      franchiseId: userData?.franchiseId,
      branchId: userData?.branchId
    });
  } catch (error: any) {
    console.error('[FranchiseRoutes] Error verifying PIN:', error);
    res.status(500).json({ success: false, error: 'Failed to verify PIN' });
  }
});

// ─── 6. DELIVERY PARTNERS SCOPED TO FRANCHISE ───────────────────────────────
router.get('/:id/riders', requireRole(['owner', 'admin', 'developer', 'platform_owner', 'franchise_manager', 'restaurant_manager']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const isOwner = FranchiseScopeService.isGlobalOwner(req.user?.email, req.user?.role);
    if (!isOwner && req.user?.franchiseId && req.user.franchiseId !== id) {
      res.status(403).json({ error: 'Cross-franchise access denied' });
      return;
    }

    const riderSnap = await adminDb.collection('delivery_partners').get();
    const riders: any[] = riderSnap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .filter(r => r.franchiseId === id || (id === 'fra_rajnandgaon' && (!r.franchiseId || r.branchId === 'main_branch')));

    res.json({ success: true, riders });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to list delivery partners' });
  }
});

router.post('/:id/riders', requireRole(['owner', 'admin', 'developer', 'platform_owner', 'franchise_manager', 'restaurant_manager']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const isOwner = FranchiseScopeService.isGlobalOwner(req.user?.email, req.user?.role);
    if (!isOwner && req.user?.franchiseId && req.user.franchiseId !== id) {
      res.status(403).json({ error: 'Cross-franchise access denied' });
      return;
    }

    const { name, email, phone, branchId, vehicleNumber } = req.body;

    if (!name || !phone) {
      res.status(400).json({ error: 'Rider name and phone number are required' });
      return;
    }

    const cleanPhone = phone.trim().replace(/[^\d+]/g, '');
    const cleanEmail = email ? email.trim().toLowerCase() : `rider.${cleanPhone.replace(/\D/g, '')}@olivepizza.in`;
    const riderId = `rider_${cleanPhone.replace(/\D/g, '').slice(-6)}_${Date.now().toString().slice(-4)}`;
    const now = new Date().toISOString();

    let targetUid = riderId;
    try {
      const existingAuth = await adminAuth.getUserByEmail(cleanEmail);
      targetUid = existingAuth.uid;
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        const secureRandomPassword = crypto.randomBytes(12).toString('base64url') + '!OP9';
        const createdAuth = await adminAuth.createUser({
          email: cleanEmail,
          password: secureRandomPassword,
          displayName: name.trim()
        });
        targetUid = createdAuth.uid;
      }
    }

    const riderData = {
      id: riderId,
      uid: targetUid,
      name: name.trim(),
      email: cleanEmail,
      phone: cleanPhone,
      role: 'delivery_partner',
      phoneVerified: true,
      franchiseId: id,
      branchId: branchId || 'main_branch',
      vehicleNumber: vehicleNumber || '',
      isActive: true,
      status: 'ACTIVE',
      isOnline: false,
      rating: 5.0,
      totalDeliveries: 0,
      createdAt: now,
      updatedAt: now,
      createdBy: req.user?.uid || 'franchise_manager',
      createdByEmail: req.user?.email || 'manager@olivepizza.in'
    };

    await adminDb.collection('delivery_partners').doc(riderId).set(riderData, { merge: true });
    if (targetUid !== riderId) {
      await adminDb.collection('delivery_partners').doc(targetUid).set(riderData, { merge: true });
    }

    await adminDb.collection('users').doc(targetUid).set({
      uid: targetUid,
      name: riderData.name,
      email: cleanEmail,
      phone: cleanPhone,
      phoneVerified: true,
      role: 'delivery_partner',
      franchiseId: id,
      branchId: riderData.branchId,
      isActive: true,
      vehicleNumber: riderData.vehicleNumber,
      updatedAt: now
    }, { merge: true }).catch(() => {});

    await FranchiseScopeService.logFranchiseAudit({
      organizationId: FranchiseScopeService.DEFAULT_ORG_ID,
      franchiseId: id,
      branchId: riderData.branchId,
      actorUid: req.user?.uid || 'franchise_manager',
      actorEmail: req.user?.email || 'manager@olivepizza.in',
      actionType: 'RIDER_PROVISIONED',
      entityType: 'delivery_partner',
      entityId: riderId,
      details: { name: riderData.name, email: cleanEmail, phone: cleanPhone, franchiseId: id }
    });

    res.status(201).json({ success: true, rider: riderData });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to provision delivery partner' });
  }
});

// PATCH /:id/riders/:riderId/status - Toggle Rider Status
router.patch('/:id/riders/:riderId/status', requireRole(['owner', 'admin', 'developer', 'platform_owner', 'franchise_manager', 'restaurant_manager']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, riderId } = req.params;
    const isOwner = FranchiseScopeService.isGlobalOwner(req.user?.email, req.user?.role);
    if (!isOwner && req.user?.franchiseId && req.user.franchiseId !== id) {
      res.status(403).json({ error: 'Cross-franchise access denied' });
      return;
    }

    const { isActive } = req.body;
    const now = new Date().toISOString();

    await adminDb.collection('delivery_partners').doc(riderId).set({
      isActive: Boolean(isActive),
      status: isActive ? 'ACTIVE' : 'INACTIVE',
      updatedAt: now,
      updatedBy: req.user?.email || 'manager'
    }, { merge: true });

    res.json({ success: true, message: `Rider ${isActive ? 'activated' : 'deactivated'} successfully` });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update rider status' });
  }
});

// DELETE /:id/riders/:riderId - Delete Rider
router.delete('/:id/riders/:riderId', requireRole(['owner', 'admin', 'developer', 'platform_owner', 'franchise_manager']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, riderId } = req.params;
    const isOwner = FranchiseScopeService.isGlobalOwner(req.user?.email, req.user?.role);
    if (!isOwner && req.user?.franchiseId && req.user.franchiseId !== id) {
      res.status(403).json({ error: 'Cross-franchise access denied' });
      return;
    }

    await adminDb.collection('delivery_partners').doc(riderId).delete();
    res.json({ success: true, message: 'Rider deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete rider' });
  }
});

// ─── 7. POS TERMINAL MANAGEMENT (REGISTER / GENERATE CODE / REVOKE) ────────
router.get('/:id/pos-terminals', requireRole(['owner', 'admin', 'developer', 'franchise_owner', 'franchise_manager', 'manager', 'restaurant_manager']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const bSnap = await adminDb.collection('franchises').get();
    const branchIds = bSnap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .filter(b => b.franchiseId === id || (id === 'fra_rajnandgaon' && b.id === 'main_branch'))
      .map(b => b.id);

    const posSnap = await adminDb.collection('pos_terminals').get();
    let terminals: any[] = posSnap.docs
      .map(d => {
        const data = d.data() as any;
        const { activationCode, ...safeData } = data;
        return { id: d.id, ...safeData };
      })
      .filter(t => t.franchiseId === id || branchIds.includes(t.branchId));

    res.json({ success: true, franchiseId: id, terminals });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to list POS terminals' });
  }
});

router.post('/:id/pos-terminals/register', requireRole(['owner', 'admin', 'developer', 'platform_owner']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { terminalName, branchId } = req.body;

    if (!terminalName || !branchId) {
      res.status(400).json({ error: 'Terminal name and branch assignment are required' });
      return;
    }

    // Atomic Uniqueness Constraint: Max 1 active/pending POS terminal per franchise
    const posSnap = await adminDb.collection('pos_terminals').where('franchiseId', '==', id).get();
    const activeTerminals = posSnap.docs.filter(d => {
      const data = d.data();
      return data.isActive !== false && data.activationStatus !== 'REVOKED';
    });

    if (activeTerminals.length >= 1) {
      res.status(409).json({
        error: 'A POS terminal is already provisioned for this franchise. Maximum 1 POS terminal permitted.',
        code: 'LIMIT_EXCEEDED'
      });
      return;
    }

    const termId = `pos_${branchId}_${Date.now().toString().slice(-4)}`;
    const activationCode = FranchisePinService.generateSecureActivationCode();
    const now = new Date().toISOString();

    const terminalData = {
      id: termId,
      terminalName: terminalName.trim(),
      organizationId: FranchiseScopeService.DEFAULT_ORG_ID,
      franchiseId: id,
      branchId,
      activationCode,
      activationStatus: 'PENDING_ACTIVATION',
      isActive: true,
      isOnline: false,
      createdAt: now,
      updatedAt: now
    };

    await adminDb.collection('pos_terminals').doc(termId).set(terminalData, { merge: true });

    await FranchiseScopeService.logFranchiseAudit({
      organizationId: terminalData.organizationId,
      franchiseId: id,
      branchId,
      actorUid: req.user?.uid || 'owner',
      actorEmail: req.user?.email || 'owner@olivepizza.in',
      actionType: 'POS_REGISTERED',
      entityType: 'pos_terminal',
      entityId: termId,
      details: { terminalName, activationCode }
    });

    res.status(201).json({ success: true, terminal: terminalData });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to register POS terminal' });
  }
});

// POST /:id/pos-terminals/:termId/activate - Franchise Manager activates Owner-provisioned POS with PIN
router.post('/:id/pos-terminals/:termId/activate', requireRole(['owner', 'admin', 'developer', 'platform_owner', 'franchise_manager']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, termId } = req.params;
    const { pin } = req.body;
    const isOwner = FranchiseScopeService.isGlobalOwner(req.user?.email, req.user?.role);

    if (!isOwner && req.user?.franchiseId && req.user.franchiseId !== id) {
      res.status(403).json({ error: 'Cross-franchise access denied' });
      return;
    }

    if (!pin || !/^\d{4}$/.test(String(pin).trim())) {
      res.status(400).json({ error: 'Franchise 4-digit PIN is required to activate POS' });
      return;
    }

    // Verify caller's PIN
    const callerUid = req.user!.uid;
    let userDoc = await adminDb.collection('franchise_users').doc(callerUid).get();
    if (!userDoc.exists) {
      userDoc = await adminDb.collection('restaurant_managers').doc(callerUid).get();
    }
    if (!userDoc.exists) {
      userDoc = await adminDb.collection('users').doc(callerUid).get();
    }
    if (!userDoc.exists && req.user?.email) {
      const snap = await adminDb.collection('franchise_users').where('email', '==', req.user.email.toLowerCase()).limit(1).get();
      if (!snap.empty) userDoc = snap.docs[0];
      else {
        const uSnap = await adminDb.collection('users').where('email', '==', req.user.email.toLowerCase()).limit(1).get();
        if (!uSnap.empty) userDoc = uSnap.docs[0];
      }
    }

    if (!userDoc.exists) {
      res.status(404).json({ error: 'Franchise manager account not found' });
      return;
    }

    const pinHash = userDoc.data()?.pinHash;
    if (!pinHash) {
      res.status(400).json({ error: 'No PIN configured for your account. Please set a PIN first.' });
      return;
    }

    const isMatch = await FranchisePinService.verifyPin(String(pin).trim(), pinHash);
    if (!isMatch) {
      res.status(401).json({ error: 'Incorrect Franchise PIN' });
      return;
    }

    const termRef = adminDb.collection('pos_terminals').doc(termId);
    const termDoc = await termRef.get();
    if (!termDoc.exists) {
      res.status(404).json({ error: 'POS terminal not found' });
      return;
    }

    const now = new Date().toISOString();
    await termRef.set({
      activationStatus: 'ACTIVATED',
      isActive: true,
      activatedAt: now,
      activatedByUid: callerUid,
      activatedByEmail: req.user?.email || '',
      updatedAt: now
    }, { merge: true });

    await FranchiseScopeService.logFranchiseAudit({
      franchiseId: id,
      actorUid: callerUid,
      actorEmail: req.user?.email || 'manager@olivepizza.in',
      actionType: 'POS_ACTIVATED',
      entityType: 'pos_terminal',
      entityId: termId,
      details: { activatedAt: now }
    });

    res.json({ success: true, message: 'POS Terminal activated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to activate POS terminal' });
  }
});

router.post('/:id/pos-terminals/:termId/revoke', requireRole(['owner', 'admin', 'developer', 'platform_owner']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, termId } = req.params;
    const now = new Date().toISOString();

    await adminDb.collection('pos_terminals').doc(termId).set({
      isActive: false,
      activationStatus: 'REVOKED',
      revokedAt: now,
      revokedBy: req.user?.uid || 'owner'
    }, { merge: true });

    await FranchiseScopeService.logFranchiseAudit({
      franchiseId: id,
      actorUid: req.user?.uid || 'owner',
      actorEmail: req.user?.email || 'owner@olivepizza.in',
      actionType: 'POS_REVOKED',
      entityType: 'pos_terminal',
      entityId: termId,
      details: { status: 'REVOKED' }
    });

    res.json({ success: true, message: 'POS terminal revoked successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to revoke POS terminal' });
  }
});

// ─── 8. LIVE & HISTORICAL ORDERS FOR THIS FRANCHISE ─────────────────────────
router.get('/:id/orders/live', requireRole(['owner', 'admin', 'developer', 'platform_owner', 'franchise_owner', 'restaurant_manager']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const bSnap = await adminDb.collection('franchises').get();
    const branchIds = bSnap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .filter(b => b.franchiseId === id || (id === 'fra_rajnandgaon' && b.id === 'main_branch'))
      .map(b => b.id);

    const orderSnap = await adminDb.collection('orders').limit(100).get();
    const activeStatuses = ['pending', 'accepted', 'preparing', 'partner_assigned', 'ready', 'picked_up', 'out_for_delivery'];

    const liveOrders = orderSnap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .filter(o => {
        const bId = o.branchId || 'main_branch';
        const s = (o.status || 'pending').toLowerCase();
        return (branchIds.includes(bId) || (id === 'fra_rajnandgaon' && bId === 'main_branch')) && activeStatuses.includes(s);
      });

    res.json({ success: true, orders: liveOrders });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch live orders for franchise' });
  }
});

// ─── 9. FRANCHISE REPORTS & MONTHLY ACCOUNTING ──────────────────────────────
router.get('/:id/reports', requireRole(['owner', 'admin', 'developer', 'platform_owner', 'franchise_owner']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const monthStart = `${currentMonth}-01T00:00:00.000Z`;
    const monthEnd = new Date(new Date(monthStart).setMonth(new Date(monthStart).getMonth() + 1)).toISOString();

    // Query real orders for this franchise in the current month
    const orderSnap = await adminDb.collection('orders')
      .where('franchiseId', '==', id)
      .limit(500)
      .get()
      .catch(async () => {
        // Fallback: unscoped query for legacy orders without franchiseId
        return adminDb.collection('orders').limit(500).get();
      });

    let grossRevenue = 0;
    let totalOrders = 0;
    let posSales = 0;
    let onlineSales = 0;
    let taxCgst = 0;
    let taxSgst = 0;
    let discountsGiven = 0;
    let refunds = 0;

    orderSnap.docs.forEach(d => {
      const o = d.data() as any;
      // Scope to this month and this franchise
      const oDate = o.createdAt || '';
      if (oDate < monthStart || oDate >= monthEnd) return;
      if (o.franchiseId && o.franchiseId !== id) return;

      const amt = Number(o.totalAmount || 0);
      const status = (o.status || '').toLowerCase();
      if (status === 'cancelled' || status === 'rejected') return;

      grossRevenue += amt;
      totalOrders++;

      const source = (o.orderSource || '').toLowerCase();
      if (source === 'pos' || source.startsWith('pos_')) posSales += amt;
      else onlineSales += amt;

      taxCgst += Number(o.cgst || o.taxAmount ? Number(o.taxAmount || 0) / 2 : 0);
      taxSgst += Number(o.sgst || o.taxAmount ? Number(o.taxAmount || 0) / 2 : 0);
      discountsGiven += Number(o.discountAmount || 0);
      if (status === 'refunded') refunds += amt;
    });

    const netSales = grossRevenue - discountsGiven - refunds;

    // Get Google Sheets status for this franchise
    let sheetsStatus: any = { status: 'UNKNOWN' };
    try {
      sheetsStatus = await FranchiseGoogleSheetsService.getFranchiseSheetsStatus(id) || { status: 'PROVISIONING_PENDING' };
    } catch { /* Sheets may not be configured */ }

    res.json({
      success: true,
      reports: {
        franchiseId: id,
        currentMonth,
        googleSheetsStatus: {
          status: sheetsStatus.status || 'UNKNOWN',
          workbookName: sheetsStatus.spreadsheetName || `Olive Pizza — ${id.toUpperCase()} — ${currentMonth}`,
          lastSyncTime: sheetsStatus.lastSyncedAt || null,
          pendingRecords: sheetsStatus.pendingSyncCount || 0,
          failedRecords: sheetsStatus.failedSyncCount || 0
        },
        monthlySalesSummary: {
          grossRevenue: Math.round(grossRevenue),
          netSales: Math.round(netSales),
          totalOrders,
          posSales: Math.round(posSales),
          onlineSales: Math.round(onlineSales),
          taxCgst: Math.round(taxCgst),
          taxSgst: Math.round(taxSgst),
          discountsGiven: Math.round(discountsGiven),
          refunds: Math.round(refunds)
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch franchise reports' });
  }
});

// ─── 10. FRANCHISE AUDIT LOGS ───────────────────────────────────────────────
router.get('/:id/audit-logs', requireRole(['owner', 'admin', 'developer', 'platform_owner', 'franchise_owner']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const snap = await adminDb.collection('franchise_audit_logs').limit(50).get().catch(() => ({ docs: [] } as any));
    const logs = snap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .filter(l => l.franchiseId === id || !l.franchiseId);

    res.json({ success: true, auditLogs: logs });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// ─── 11. FRANCHISE SETTINGS UPDATE (PATCH /:id/settings) ─────────────────────
router.patch('/:id/settings', requireRole(['owner', 'admin', 'developer', 'platform_owner']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { businessHours, deliverySettings, contactPhone, contactEmail } = req.body;

    const updates: Record<string, any> = {
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.uid || 'owner'
    };

    if (businessHours) updates.businessHours = businessHours;
    if (deliverySettings) updates.deliverySettings = deliverySettings;
    if (contactPhone) updates.contactPhone = contactPhone;
    if (contactEmail) updates.contactEmail = contactEmail;

    await adminDb.collection('franchise_entities').doc(id).set(updates, { merge: true });

    await FranchiseScopeService.logFranchiseAudit({
      franchiseId: id,
      actorUid: req.user?.uid || 'owner',
      actorEmail: req.user?.email || 'owner@olivepizza.in',
      actionType: 'SETTINGS_UPDATED',
      entityType: 'franchise_settings',
      entityId: id,
      details: updates
    });

    res.json({ success: true, message: 'Franchise settings updated successfully', updates });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update franchise settings' });
  }
});

// ─── 12. PROVISIONING WIZARD (EXISTING FULL MULTI-STEP PROVISION) ───────────
router.post('/provision', requireRole(['owner', 'admin', 'developer', 'platform_admin', 'platform_owner']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      name,
      code,
      city,
      state,
      address,
      lat,
      lng,
      phone,
      email,
      franchiseOwnerEmail,
      franchiseOwnerName,
      restaurantManagerEmail,
      restaurantManagerName,
      maxDeliveryRadiusKm,
      openingTime,
      closingTime,
      posTerminalCount,
      posTerminalNames,
      organizationId
    } = req.body;

    if (!name || !city) {
      res.status(400).json({ error: 'Franchise name and city are required' });
      return;
    }

    const orgId = organizationId || FranchiseScopeService.DEFAULT_ORG_ID;
    const cleanCity = city.trim();
    const slug = cleanCity.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const cleanCode = code ? code.trim().toUpperCase() : `FRA-${cleanCity.slice(0, 3).toUpperCase()}-01`;
    const franchiseId = `fra_${cleanCity.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    const branchId = `${cleanCity.toLowerCase().replace(/[^a-z0-9]/g, '_')}_branch`;
    const now = new Date().toISOString();

    // 1. Franchise Entity Record
    const franchiseEntity: FranchiseEntity = {
      id: franchiseId,
      slug,
      organizationId: orgId,
      name: name.trim(),
      code: cleanCode,
      region: state || 'Chhattisgarh',
      city: cleanCity,
      contactEmail: email || `franchise.${slug}@olivepizza.in`,
      contactPhone: phone || '+91 91799 44445',
      franchiseOwnerName: franchiseOwnerName || 'Franchise Partner',
      franchiseOwnerEmail: franchiseOwnerEmail ? franchiseOwnerEmail.trim().toLowerCase() : undefined,
      mainBranchId: branchId,
      isActive: true,
      status: 'ACTIVE',
      businessHours: {
        openingTime: openingTime || '12:00',
        closingTime: closingTime || '23:59',
        isOpenToday: true
      },
      deliverySettings: {
        maxDeliveryRadiusKm: Number(maxDeliveryRadiusKm) || 12,
        deliveryFee: 30,
        freeDeliveryThreshold: 299,
        minOrderAmount: 99
      },
      createdAt: now,
      updatedAt: now
    };

    await adminDb.collection('franchise_entities').doc(franchiseId).set(franchiseEntity, { merge: true });

    // 2. Primary Branch Record
    const branchData = {
      id: branchId,
      franchiseId,
      organizationId: orgId,
      name: `${name.trim()} (Main Branch)`,
      code: `OP-${cleanCity.slice(0, 3).toUpperCase()}-01`,
      city: cleanCity,
      state: state ? state.trim() : 'Chhattisgarh',
      address: address ? address.trim() : `${cleanCity}, Chhattisgarh`,
      lat: Number(lat) || 21.0810244,
      lng: Number(lng) || 81.0123793,
      phone: phone || '+91 91799 44445',
      email: email || `branch.${slug}@olivepizza.in`,
      franchiseOwnerEmail: franchiseOwnerEmail ? franchiseOwnerEmail.trim().toLowerCase() : undefined,
      restaurantManagerEmail: restaurantManagerEmail ? restaurantManagerEmail.trim().toLowerCase() : undefined,
      maxDeliveryRadiusKm: Number(maxDeliveryRadiusKm) || 12,
      openingTime: openingTime || '12:00',
      closingTime: closingTime || '23:59',
      isActive: true,
      isHeadquarters: false,
      posTerminalCount: Number(posTerminalCount) || 1,
      createdAt: now,
      updatedAt: now,
      createdBy: req.user?.uid || 'owner'
    };

    await adminDb.collection('franchises').doc(branchId).set(branchData, { merge: true });

    // 3. Provision Franchise Owner Account if provided
    if (franchiseOwnerEmail) {
      const foEmail = franchiseOwnerEmail.trim().toLowerCase();
      const foId = `user_fo_${foEmail.replace(/[^a-z0-9]/g, '_')}`;
      await adminDb.collection('users').doc(foId).set({
        uid: foId,
        email: foEmail,
        name: franchiseOwnerName || 'Franchise Owner',
        role: 'franchise_owner',
        organizationId: orgId,
        franchiseId,
        branchIds: [branchId],
        isActive: true,
        updatedAt: now,
        createdAt: now
      }, { merge: true });
    }

    // 4. Provision Restaurant Manager Account if provided
    if (restaurantManagerEmail) {
      const rmEmail = restaurantManagerEmail.trim().toLowerCase();
      const rmId = `mgr_${rmEmail.replace(/[^a-z0-9]/g, '_')}`;
      await adminDb.collection('restaurant_managers').doc(rmId).set({
        id: rmId,
        email: rmEmail,
        name: restaurantManagerName || 'Restaurant Manager',
        role: 'restaurant_manager',
        organizationId: orgId,
        franchiseId,
        branchId,
        branchName: branchData.name,
        permissions: ['dashboard.view', 'orders.live', 'orders.history', 'inventory.view', 'notifications.send', 'delivery.view'],
        isActive: true,
        updatedAt: now,
        createdAt: now
      }, { merge: true });
    }

    // 5. Provision POS Terminals with secure 6-digit activation codes
    const terminalCount = Math.max(1, Number(posTerminalCount) || 1);
    const terminalNamesList = Array.isArray(posTerminalNames) && posTerminalNames.length > 0 
      ? posTerminalNames 
      : Array.from({ length: terminalCount }, (_, i) => `${cleanCode} Counter ${i + 1}`);

    for (let i = 0; i < terminalCount; i++) {
      const termId = `pos_${branchId}_${i + 1}`;
      const activationCode = FranchisePinService.generateSecureActivationCode();
      await adminDb.collection('pos_terminals').doc(termId).set({
        id: termId,
        organizationId: orgId,
        franchiseId,
        branchId,
        branchName: branchData.name,
        terminalName: terminalNamesList[i] || `Counter ${i + 1}`,
        activationCode,
        activationStatus: 'ACTIVATED',
        isActive: true,
        createdAt: now
      }, { merge: true });
    }

    // 6. Asynchronously trigger automatic Franchise Google Spreadsheet provisioning
    let sheetsProvisioning: any = { status: 'PROVISIONING_PENDING' };
    try {
      sheetsProvisioning = await FranchiseGoogleSheetsService.provisionFranchiseSpreadsheet(franchiseId, name, state);
    } catch (sheetsErr: any) {
      console.warn('[FranchiseProvision] Google Sheets initial creation notice:', sheetsErr.message);
    }

    // 7. Log Audit Event
    await FranchiseScopeService.logFranchiseAudit({
      organizationId: orgId,
      franchiseId,
      branchId,
      actorUid: req.user?.uid || 'owner',
      actorEmail: req.user?.email || 'owner@olivepizza.in',
      actionType: 'FRANCHISE_PROVISIONED',
      entityType: 'franchise_full_provision',
      entityId: franchiseId,
      details: { franchiseEntity, branchData, terminalCount }
    });

    res.status(201).json({
      success: true,
      message: 'Franchise, primary branch, manager accounts, and POS terminals provisioned successfully',
      franchise: franchiseEntity,
      branch: branchData,
      terminalsProvisioned: terminalCount,
      sheetsProvisioning
    });
  } catch (error: any) {
    console.error('[Franchises] Error provisioning franchise:', error);
    res.status(500).json({ error: error?.message || 'Failed to provision franchise' });
  }
});

// Default list fallback
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const scope = req.user?.scope || FranchiseScopeService.resolveScope(req.user);
    const snap = await adminDb.collection('franchises').get().catch(() => ({ docs: [] } as any));
    let branches: any[] = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

    if (!scope.isGlobalOwner && !scope.isFranchiseOwner) {
      branches = branches.filter(b => scope.branchIds.includes(b.id) || scope.branchId === b.id);
    }
    res.json({ success: true, branches });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to load franchise data' });
  }
});


// ─── 13. INDIVIDUAL RESTAURANT/BRANCH CONTROL (GET /:id/restaurants/:restaurantSlug) ───
router.get('/:id/restaurants/:restaurantSlug', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, restaurantSlug } = req.params;
    const cleanSlug = restaurantSlug.toLowerCase().trim();

    const bSnap = await adminDb.collection('franchises').get();
    let branch = bSnap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .find(b => 
        (b.id === cleanSlug || b.id === `${cleanSlug}_branch` || b.code?.toLowerCase() === cleanSlug) &&
        (b.franchiseId === id || (id === 'fra_rajnandgaon' && (b.id === 'main_branch' || b.franchiseId === 'fra_primary')))
      );

    if (!branch && cleanSlug === 'main-branch') {
      branch = bSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).find(b => b.id === 'main_branch');
    }

    if (!branch) {
      res.status(404).json({ error: `Restaurant/Branch '${cleanSlug}' not found under this franchise`, code: 'NOT_FOUND' });
      return;
    }

    // Fetch assigned managers
    const mgrSnap = await adminDb.collection('restaurant_managers').get();
    const branchManagers = mgrSnap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .filter(m => m.branchId === branch.id);

    // Fetch assigned POS terminals
    const posSnap = await adminDb.collection('pos_terminals').get();
    const branchTerminals = posSnap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .filter(t => t.branchId === branch.id);

    // Fetch live orders count
    const orderSnap = await adminDb.collection('orders').limit(50).get();
    const activeStatuses = ['pending', 'accepted', 'preparing', 'partner_assigned', 'ready', 'picked_up', 'out_for_delivery'];
    const liveOrders = orderSnap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .filter(o => (o.branchId === branch.id || (branch.id === 'main_branch' && !o.branchId)) && activeStatuses.includes((o.status || '').toLowerCase()));

    res.json({
      success: true,
      restaurant: {
        ...branch,
        managers: branchManagers.map(({ pinHash, ...safe }) => safe),
        posTerminals: branchTerminals.map(({ activationCode, ...safe }) => safe),
        liveOrdersCount: liveOrders.length,
        operationalAppUrl: 'http://localhost:5176'
      }
    });
  } catch (error: any) {
    console.error('[FranchiseRoutes] Error loading restaurant control:', error);
    res.status(500).json({ error: 'Failed to load restaurant control data' });
  }
});

// ─── 14. RESTAURANT SETTINGS UPDATE (PATCH /:id/restaurants/:restaurantSlug/settings) ───
router.patch('/:id/restaurants/:restaurantSlug/settings', requireRole(['owner', 'admin', 'developer', 'platform_owner']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, restaurantSlug } = req.params;
    const { openingTime, closingTime, maxDeliveryRadiusKm, address, phone, email, isAcceptingOrders, temporaryClosure } = req.body;

    const bSnap = await adminDb.collection('franchises').get();
    const branchDoc = bSnap.docs.find(d => 
      (d.id === restaurantSlug || d.id === `${restaurantSlug}_branch`) &&
      (d.data().franchiseId === id || (id === 'fra_rajnandgaon' && d.id === 'main_branch'))
    );

    const branchId = branchDoc ? branchDoc.id : restaurantSlug;
    const updates: Record<string, any> = {
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.uid || 'owner'
    };

    if (openingTime) updates.openingTime = openingTime;
    if (closingTime) updates.closingTime = closingTime;
    if (maxDeliveryRadiusKm !== undefined) updates.maxDeliveryRadiusKm = Number(maxDeliveryRadiusKm);
    if (address) updates.address = address;
    if (phone) updates.phone = phone;
    if (email) updates.email = email;
    if (isAcceptingOrders !== undefined) updates.isAcceptingOrders = Boolean(isAcceptingOrders);
    if (temporaryClosure !== undefined) updates.temporaryClosure = temporaryClosure;

    await adminDb.collection('franchises').doc(branchId).set(updates, { merge: true });

    await FranchiseScopeService.logFranchiseAudit({
      franchiseId: id,
      branchId,
      actorUid: req.user?.uid || 'owner',
      actorEmail: req.user?.email || 'owner@olivepizza.in',
      actionType: 'RESTAURANT_SETTINGS_UPDATED',
      entityType: 'restaurant_branch',
      entityId: branchId,
      details: updates
    });

    res.json({ success: true, message: 'Restaurant settings updated successfully', updates });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update restaurant settings' });
  }
});

// ─── 15. PERMISSION MANAGEMENT (PATCH /:id/permissions) ──────────────────────
router.patch('/:id/permissions', requireRole(['owner', 'admin', 'developer', 'platform_owner']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { targetUserId, targetRole, permissions } = req.body;

    if (!targetUserId || !Array.isArray(permissions)) {
      res.status(400).json({ error: 'targetUserId and permissions array are required' });
      return;
    }

    const updates = {
      permissions,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.uid || 'owner'
    };

    if (targetRole === 'restaurant_manager') {
      await adminDb.collection('restaurant_managers').doc(targetUserId).set(updates, { merge: true });
    } else {
      await adminDb.collection('users').doc(targetUserId).set(updates, { merge: true });
    }

    await FranchiseScopeService.logFranchiseAudit({
      franchiseId: id,
      actorUid: req.user?.uid || 'owner',
      actorEmail: req.user?.email || 'owner@olivepizza.in',
      actionType: 'PERMISSIONS_MODIFIED',
      entityType: targetRole || 'user_permission',
      entityId: targetUserId,
      details: { permissions }
    });

    res.json({ success: true, message: 'Permissions updated successfully', permissions });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update permissions' });
  }
});


// ─── 16. OWNER ACCESS ACCOUNTS LISTING (GET /:id/access-accounts) ─────────────
router.get('/:id/access-accounts', requireRole(['owner', 'admin', 'developer', 'platform_owner', 'franchise_owner']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // 1. Fetch Franchise Owner & Users
    const uSnap = await adminDb.collection('users').get();
    const fUsers = uSnap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .filter(u => u.franchiseId === id || (id === 'fra_rajnandgaon' && (u.role === 'owner' || u.email === 'olivepizzarjn@gmail.com' || u.email === 'webhub2811@gmail.com')));

    // 2. Fetch Restaurant Managers
    const mgrSnap = await adminDb.collection('restaurant_managers').get();
    const fManagers = mgrSnap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .filter(m => m.franchiseId === id || (id === 'fra_rajnandgaon' && (!m.franchiseId || m.branchId === 'main_branch')));

    // 3. Fetch Delivery Partners
    const riderSnap = await adminDb.collection('delivery_partners').get();
    const fRiders = riderSnap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .filter(r => r.franchiseId === id || (id === 'fra_rajnandgaon' && (!r.franchiseId || r.branchId === 'main_branch')));

    // Aggregate accounts with structured application access
    const accounts: any[] = [];

    // Add Owner / Franchise Managers
    fUsers.forEach(u => {
      const perms = Array.isArray(u.permissions) ? u.permissions : [];
      accounts.push({
        id: u.id,
        name: u.name || u.displayName || 'Franchise Partner',
        email: u.email,
        role: u.role || 'franchise_manager',
        branchId: u.branchId || 'all_branches',
        accountStatus: u.isActive === false ? 'SUSPENDED' : 'ACTIVE',
        applicationAccess: {
          app_franchise_management: perms.includes('app_franchise_management') || u.role === 'owner' || u.role === 'franchise_manager',
          app_restaurant_management: perms.includes('app_restaurant_management') || u.role === 'owner',
          app_pos: perms.includes('app_pos') || perms.includes('pos.billing'),
          app_delivery: perms.includes('app_delivery') || u.role === 'delivery_partner'
        },
        permissions: perms,
        updatedAt: u.updatedAt || new Date().toISOString()
      });
    });

    // Add Restaurant Managers
    fManagers.forEach(m => {
      const perms = Array.isArray(m.permissions) ? m.permissions : [];
      accounts.push({
        id: m.id,
        name: m.name || 'Restaurant Manager',
        email: m.email,
        role: 'restaurant_manager',
        branchId: m.branchId || 'main_branch',
        accountStatus: m.isActive === false ? 'SUSPENDED' : 'ACTIVE',
        applicationAccess: {
          app_franchise_management: perms.includes('app_franchise_management'),
          app_restaurant_management: perms.includes('app_restaurant_management') || true,
          app_pos: perms.includes('app_pos') || perms.includes('pos.billing'),
          app_delivery: perms.includes('app_delivery')
        },
        permissions: perms,
        updatedAt: m.updatedAt || new Date().toISOString()
      });
    });

    // Add Delivery Riders
    fRiders.forEach(r => {
      const perms = Array.isArray(r.permissions) ? r.permissions : [];
      accounts.push({
        id: r.id,
        name: r.name || 'Delivery Partner',
        email: r.email || r.phone || 'rider@olivepizza.in',
        phone: r.phone,
        role: 'delivery_partner',
        branchId: r.branchId || 'main_branch',
        accountStatus: r.isActive === false ? 'SUSPENDED' : 'ACTIVE',
        applicationAccess: {
          app_franchise_management: false,
          app_restaurant_management: false,
          app_pos: false,
          app_delivery: true
        },
        permissions: perms,
        updatedAt: r.updatedAt || new Date().toISOString()
      });
    });

    res.json({ success: true, accounts });
  } catch (error: any) {
    console.error('[FranchiseRoutes] Error loading access accounts:', error);
    res.status(500).json({ error: 'Failed to load access accounts' });
  }
});

// ─── 17. OWNER EDIT ACCESS (POST /:id/access/edit) ───────────────────────────
router.post('/:id/access/edit', requireRole(['owner', 'admin', 'developer', 'platform_owner']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { targetUserId, targetRole, applicationAccess, permissions, accountStatus, assignedBranchId } = req.body;

    if (!targetUserId) {
      res.status(400).json({ error: 'targetUserId is required' });
      return;
    }

    // Build structured permissions
    const updatedPerms: string[] = Array.isArray(permissions) ? [...permissions] : [];

    if (applicationAccess) {
      if (applicationAccess.app_franchise_management && !updatedPerms.includes('app_franchise_management')) updatedPerms.push('app_franchise_management');
      if (!applicationAccess.app_franchise_management) {
        const idx = updatedPerms.indexOf('app_franchise_management');
        if (idx > -1) updatedPerms.splice(idx, 1);
      }

      if (applicationAccess.app_restaurant_management && !updatedPerms.includes('app_restaurant_management')) updatedPerms.push('app_restaurant_management');
      if (!applicationAccess.app_restaurant_management) {
        const idx = updatedPerms.indexOf('app_restaurant_management');
        if (idx > -1) updatedPerms.splice(idx, 1);
      }

      if (applicationAccess.app_pos && !updatedPerms.includes('app_pos')) {
        updatedPerms.push('app_pos');
        if (!updatedPerms.includes('pos.billing')) updatedPerms.push('pos.billing');
      }
      if (!applicationAccess.app_pos) {
        const idx1 = updatedPerms.indexOf('app_pos');
        if (idx1 > -1) updatedPerms.splice(idx1, 1);
        const idx2 = updatedPerms.indexOf('pos.billing');
        if (idx2 > -1) updatedPerms.splice(idx2, 1);
      }

      if (applicationAccess.app_delivery && !updatedPerms.includes('app_delivery')) updatedPerms.push('app_delivery');
      if (!applicationAccess.app_delivery) {
        const idx = updatedPerms.indexOf('app_delivery');
        if (idx > -1) updatedPerms.splice(idx, 1);
      }
    }

    const updates: Record<string, any> = {
      permissions: updatedPerms,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user?.uid || 'owner'
    };

    if (accountStatus) {
      updates.isActive = accountStatus === 'ACTIVE';
      updates.status = accountStatus;
    }
    if (assignedBranchId) {
      updates.branchId = assignedBranchId;
    }

    // Update in target collection
    if (targetRole === 'restaurant_manager') {
      await adminDb.collection('restaurant_managers').doc(targetUserId).set(updates, { merge: true });
    } else if (targetRole === 'delivery_partner') {
      await adminDb.collection('delivery_partners').doc(targetUserId).set(updates, { merge: true });
    } else {
      await adminDb.collection('users').doc(targetUserId).set(updates, { merge: true });
    }

    // Log Server-Authoritative Audit Event
    await FranchiseScopeService.logFranchiseAudit({
      franchiseId: id,
      branchId: assignedBranchId,
      actorUid: req.user?.uid || 'owner',
      actorEmail: req.user?.email || 'owner@olivepizza.in',
      actionType: 'ACCESS_PERMISSIONS_CHANGED',
      entityType: targetRole || 'user_account',
      entityId: targetUserId,
      details: {
        applicationAccess,
        permissions: updatedPerms,
        accountStatus,
        assignedBranchId
      }
    });

    res.json({
      success: true,
      message: `Access permissions updated successfully for ${targetUserId}`,
      targetUserId,
      applicationAccess,
      permissions: updatedPerms,
      accountStatus: accountStatus || 'ACTIVE'
    });
  } catch (error: any) {
    console.error('[FranchiseRoutes] Error updating access:', error);
    res.status(500).json({ error: 'Failed to update access permissions' });
  }
});

// ─── 18. OWNER "PROVIDE POS" (ON-DEMAND PROVISIONING) (POST /:id/pos/provide) ─
router.post('/:id/pos/provide', requireRole(['owner', 'admin', 'developer', 'platform_owner']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { branchId, terminalName, assignedUserId, posTerminalCount = 1 } = req.body;

    if (!branchId) {
      res.status(400).json({ error: 'branchId is required to provide POS' });
      return;
    }

    const createdTerminals: any[] = [];
    const count = Math.max(1, Math.min(Number(posTerminalCount) || 1, 10));

    for (let i = 0; i < count; i++) {
      const termSuffix = FranchisePinService.generateSecureTerminalSuffix();
      const terminalId = `pos_${branchId}_${termSuffix}`;
      const activationCode = FranchisePinService.generateSecureActivationCode();

      const termDoc = {
        id: terminalId,
        organizationId: req.user?.organizationId || 'org_olive_pizza',
        franchiseId: id,
        branchId,
        terminalName: terminalName ? (count > 1 ? `${terminalName} #${i + 1}` : terminalName) : `Counter ${i + 1} — Billing Terminal`,
        activationCode,
        activationStatus: 'ACTIVATED',
        isActive: true,
        isOnline: false,
        assignedUserId: assignedUserId || null,
        totalOrdersProcessed: 0,
        totalRevenueCollected: 0,
        registeredAt: new Date().toISOString(),
        registeredBy: req.user?.uid || 'owner',
        lastSeenAt: new Date().toISOString()
      };

      await adminDb.collection('pos_terminals').doc(terminalId).set(termDoc);
      createdTerminals.push(termDoc);

      // If assigned user is provided, immediately grant app_pos permission
      if (assignedUserId) {
        await adminDb.collection('users').doc(assignedUserId).set({
          permissions: ['app_pos', 'pos.billing'],
          terminalId,
          updatedAt: new Date().toISOString()
        }, { merge: true }).catch(() => {});
      }
    }

    // Log Server Audit
    await FranchiseScopeService.logFranchiseAudit({
      franchiseId: id,
      branchId,
      actorUid: req.user?.uid || 'owner',
      actorEmail: req.user?.email || 'owner@olivepizza.in',
      actionType: 'POS_TERMINALS_PROVISIONED',
      entityType: 'pos_terminal',
      entityId: createdTerminals[0].id,
      details: {
        terminalsCreated: createdTerminals.map(t => ({ id: t.id, code: t.activationCode, name: t.terminalName }))
      }
    });

    res.status(201).json({
      success: true,
      message: `Successfully provisioned ${createdTerminals.length} POS terminal(s)`,
      terminals: createdTerminals
    });
  } catch (error: any) {
    console.error('[FranchiseRoutes] Error providing POS:', error);
    res.status(500).json({ error: 'Failed to provide POS terminals' });
  }
});


// ─── 19. GLOBAL OWNER: ALL POS TERMINALS VIEW (GET /api/pos/all-terminals) ───
router.get('/pos/all-terminals', requireRole(['owner', 'admin', 'developer', 'platform_owner', 'franchise_owner']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isGlobalOwner = ['owner', 'admin', 'developer', 'platform_owner'].includes(req.user?.role || '') ||
      req.user?.email === 'olivepizzarjn@gmail.com' ||
      req.user?.email === 'webhub2811@gmail.com';

    const userFranchiseId = req.user?.franchiseId;

    // Fetch all franchises from Firestore
    const fSnap = await adminDb.collection('franchise_entities').get();
    const franchisesMap = new Map<string, any>();
    fSnap.docs.forEach(d => franchisesMap.set(d.id, { id: d.id, ...(d.data() as any) }));

    // Fetch all branches from Firestore
    const bSnap = await adminDb.collection('franchises').get();
    const branchesMap = new Map<string, any>();
    bSnap.docs.forEach(d => branchesMap.set(d.id, { id: d.id, ...(d.data() as any) }));

    // Fetch all POS terminals — strip activationCode before sending
    const posSnap = await adminDb.collection('pos_terminals').get();
    let terminals = posSnap.docs.map(d => {
      const data = d.data() as any;
      const { activationCode, ...safeData } = data;
      return { id: d.id, ...safeData };
    });

    // Filter by franchise if not global owner
    if (!isGlobalOwner && userFranchiseId) {
      terminals = terminals.filter(t => t.franchiseId === userFranchiseId);
    }

    // Enrich with franchise and branch details — no fake fallback values
    const enriched = terminals.map(t => {
      const fra = franchisesMap.get(t.franchiseId);
      const br = branchesMap.get(t.branchId);
      return {
        ...t,
        franchiseName: fra?.name || t.franchiseId,
        franchiseCode: fra?.code || null,
        branchName: br?.name || t.branchId,
        todaySales: t.todaySales || 0,
        todayOrders: t.todayOrders || 0,
        currentShift: t.currentShift || null,
        assignedUserName: t.assignedUserName || null
      };
    });

    res.json({
      success: true,
      terminals: enriched,
      isGlobalOwner,
      totalTerminals: enriched.length,
      activeTerminals: enriched.filter(t => t.isActive).length
    });
  } catch (error: any) {
    console.error('[FranchiseRoutes] Error loading all POS terminals:', error);
    res.status(500).json({ error: 'Failed to load all POS terminals' });
  }
});

// ─── 20. GLOBAL OWNER: SWITCH POS OPERATIONAL CONTEXT (POST /api/pos/owner-context/switch) ───
router.post('/pos/owner-context/switch', requireRole(['owner', 'admin', 'developer', 'platform_owner']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { franchiseId, branchId, terminalId, previousContext } = req.body;

    if (!franchiseId || !branchId || !terminalId) {
      res.status(400).json({ error: 'franchiseId, branchId, and terminalId are required for context switch' });
      return;
    }

    // Resolve franchise
    const fSnap = await adminDb.collection('franchise_entities').doc(franchiseId).get();
    let franchiseName = fSnap.exists ? (fSnap.data() as any)?.name : `Franchise ${franchiseId}`;

    // Resolve branch
    const bSnap = await adminDb.collection('franchises').doc(branchId).get();
    let branchName = bSnap.exists ? (bSnap.data() as any)?.name : `Branch ${branchId}`;

    // Resolve terminal
    const tSnap = await adminDb.collection('pos_terminals').doc(terminalId).get();
    const terminalData = tSnap.exists ? (tSnap.data() as any) : {
      id: terminalId,
      terminalName: 'POS Billing Terminal',
      isActive: true,
      activationStatus: 'ACTIVATED'
    };

    if (tSnap.exists && terminalData.isActive === false) {
      res.status(403).json({ error: 'Cannot switch context to a revoked or deactivated POS terminal', code: 'TERMINAL_REVOKED' });
      return;
    }

    // Log Server-Authoritative Audit Event
    await FranchiseScopeService.logFranchiseAudit({
      franchiseId,
      branchId,
      actorUid: req.user?.uid || 'owner',
      actorEmail: req.user?.email || 'owner@olivepizza.in',
      actionType: 'OWNER_POS_CONTEXT_SWITCH',
      entityType: 'pos_terminal_session',
      entityId: terminalId,
      details: {
        previousContext: previousContext || null,
        newContext: {
          franchiseId,
          franchiseName,
          branchId,
          branchName,
          terminalId,
          terminalName: terminalData.terminalName
        },
        timestamp: new Date().toISOString()
      }
    });

    res.json({
      success: true,
      message: `Owner POS context switched to ${franchiseName} ➔ ${branchName} ➔ ${terminalData.terminalName}`,
      session: {
        isOwnerMode: true,
        cashierName: `👑 Owner (${req.user?.email?.split('@')[0] || 'Master'})`,
        cashierUid: req.user?.uid || 'owner_global',
        role: 'owner',
        terminalId,
        terminalName: terminalData.terminalName || 'POS Terminal',
        branchId,
        branchName,
        franchiseId,
        franchiseName,
        organizationId: 'org_olive_pizza',
        sessionStartedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('[FranchiseRoutes] Error switching owner POS context:', error);
    res.status(500).json({ error: 'Failed to switch owner POS context' });
  }
});


// ─── ALIAS ROUTE: /:id/telemetry (Maps to franchise dashboard telemetry) ───
router.get('/:id/telemetry', requireRole(['owner', 'admin', 'developer', 'platform_owner', 'franchise_owner']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Resolve franchise name from Firestore
    const fDoc = await adminDb.collection('franchise_entities').doc(id).get();
    const franchiseName = fDoc.exists ? (fDoc.data() as any)?.name : id;

    // Real order metrics
    const orderSnap = await adminDb.collection('orders').limit(200).get().catch(() => ({ docs: [] } as any));
    let todaySales = 0, todayOrders = 0, activeOrders = 0, completedOrders = 0;
    const today = new Date().toISOString().slice(0, 10);
    orderSnap.docs.forEach((d: any) => {
      const o = d.data();
      if (o.franchiseId && o.franchiseId !== id) return;
      const oDate = (o.createdAt || '').slice(0, 10);
      if (oDate !== today) return;
      const status = (o.status || '').toLowerCase();
      if (status !== 'cancelled' && status !== 'rejected') {
        todaySales += Number(o.totalAmount || 0);
        todayOrders++;
      }
      if (['pending','accepted','preparing','ready','out_for_delivery'].includes(status)) activeOrders++;
      else if (['delivered','completed'].includes(status)) completedOrders++;
    });

    const posSnap = await adminDb.collection('pos_terminals').get().catch(() => ({ docs: [] } as any));
    const activeTerminals = posSnap.docs.filter((d: any) => {
      const t = d.data();
      return (t.franchiseId === id) && t.isActive !== false;
    }).length;

    const riderSnap = await adminDb.collection('delivery_partners').get().catch(() => ({ docs: [] } as any));
    const activeRiders = riderSnap.docs.filter((d: any) => {
      const r = d.data();
      return (r.franchiseId === id) && r.isActive !== false && r.isOnline === true;
    }).length;

    res.json({
      success: true,
      franchiseId: id,
      franchise: { id, name: franchiseName },
      telemetry: { todaySales, todayOrders, activeOrders, completedOrders, activeTerminals, activeRiders }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── ALIAS ROUTE: /:id/restaurants (Maps to /:id/branches) ───
router.get('/:id/restaurants', requireRole(['owner', 'admin', 'developer', 'platform_owner', 'franchise_owner']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const bSnap = await adminDb.collection('franchises').get();
    const branches = bSnap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .filter(b => b.franchiseId === id || (id === 'fra_rajnandgaon' && (b.id === 'main_branch' || b.franchiseId === 'fra_primary')));

    res.json({
      success: true,
      franchiseId: id,
      restaurants: branches,
      branches
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── ALIAS ROUTE: /:id/live-orders (Maps to /:id/orders/live) ───
router.get('/:id/live-orders', requireRole(['owner', 'admin', 'developer', 'platform_owner', 'franchise_owner', 'restaurant_manager']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Verify franchise access if caller is not global owner
    const scope = FranchiseScopeService.resolveScope(req.user);
    try {
      FranchiseScopeService.assertFranchiseAccess(scope, id);
    } catch (scopeErr: any) {
      res.status(403).json({ success: false, error: scopeErr.message || 'Forbidden: Access denied to this franchise orders' });
      return;
    }

    const orderSnap = await adminDb.collection('orders')
      .where('franchiseId', '==', id)
      .limit(100)
      .get()
      .catch(async () => {
        return await adminDb.collection('orders').limit(100).get();
      });

    const orders = orderSnap.docs
      .filter(d => {
        const data = d.data();
        return !data.franchiseId || data.franchiseId === id || id === 'fra_primary' || id === 'fra_rajnandgaon';
      })
      .map(d => OrderProjectionService.projectForFranchiseManager(d.data(), d.id));

    res.json({
      success: true,
      franchiseId: id,
      count: orders.length,
      orders
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// ============================================================================
// 16. DEDICATED FRANCHISE GOOGLE SHEETS MANAGEMENT & SYNC
// ============================================================================

// GET /api/franchises/:id/sheets-status — Get dedicated Google Spreadsheet status for this franchise
router.get('/:id/sheets-status', requireRole(['owner', 'admin', 'developer', 'platform_owner', 'franchise_owner']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const status = await FranchiseGoogleSheetsService.getFranchiseSheetsStatus(id);
    
    if (!status) {
      res.json({
        success: true,
        franchiseId: id,
        status: 'PROVISIONING_PENDING',
        spreadsheetName: `Olive Pizza — ${id} Reports`,
        spreadsheetUrl: null,
        lastSyncedAt: new Date().toISOString(),
        currentMonthTab: FranchiseGoogleSheetsService.getMonthTabName(),
        pendingSyncCount: 0,
        failedSyncCount: 0
      });
      return;
    }

    res.json({
      success: true,
      ...status
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/franchises/:id/provision-sheets — Manually provision/recreate Google Spreadsheet for franchise
router.post('/:id/provision-sheets', requireRole(['owner', 'admin', 'developer', 'platform_owner']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const fDoc = await adminDb.collection('franchise_entities').doc(id).get();
    const fData = fDoc.exists ? fDoc.data() : {};
    const franchiseName = fData?.name || id;
    const region = fData?.region || 'Chhattisgarh';

    const result = await FranchiseGoogleSheetsService.provisionFranchiseSpreadsheet(id, franchiseName, region);
    res.json({
      success: result.success,
      spreadsheetId: result.spreadsheetId,
      spreadsheetUrl: result.spreadsheetUrl,
      error: result.error
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/franchises/:id/sync-sheets — Manually trigger batch sync of recent orders to franchise sheet
router.post('/:id/sync-sheets', requireRole(['owner', 'admin', 'developer', 'platform_owner']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const ordersSnap = await adminDb.collection('orders')
      .where('franchiseId', '==', id)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get()
      .catch(async () => {
        return await adminDb.collection('orders').limit(50).get();
      });

    let syncedCount = 0;
    for (const doc of ordersSnap.docs) {
      const orderData = { id: doc.id, ...doc.data() };
      const ok = await FranchiseGoogleSheetsService.syncOrderToFranchise(orderData);
      if (ok) syncedCount++;
    }

    res.json({
      success: true,
      message: `Synced ${syncedCount} orders to dedicated franchise sheet`,
      syncedCount
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// FRANCHISE STAFF MANAGEMENT (Role Assignment, Branch Binding, Deactivation)
// ============================================================================

// GET /api/franchises/:id/staff — List staff members scoped to this franchise
router.get('/:id/staff', verifyToken, requireRole(['franchise_owner', 'franchise_manager', 'owner', 'admin', 'developer']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const scope = req.user?.scope;
    if (scope) {
      FranchiseScopeService.assertFranchiseAccess(scope, id);
    }

    const { role, branchId } = req.query;

    let queryRef: any = adminDb.collection('users').where('franchiseId', '==', id);
    if (role && typeof role === 'string') {
      queryRef = queryRef.where('role', '==', role);
    }
    if (branchId && typeof branchId === 'string' && branchId !== 'all') {
      queryRef = queryRef.where('branchId', '==', branchId);
    }

    const snap = await queryRef.get();
    const staff = snap.docs.map((doc: any) => {
      const d = doc.data();
      return {
        id: doc.id,
        uid: doc.id,
        name: d.name || d.displayName || 'Staff Member',
        email: d.email || '',
        phone: d.phone || '',
        role: d.role || 'kitchen_staff',
        franchiseId: d.franchiseId || id,
        branchId: d.branchId || 'main_branch',
        branchIds: d.branchIds || [d.branchId || 'main_branch'],
        permissions: d.permissions || [],
        isActive: d.isActive !== false,
        terminalId: d.terminalId || null,
        createdAt: d.createdAt || null,
        updatedAt: d.updatedAt || null
      };
    });

    res.json({
      success: true,
      franchiseId: id,
      count: staff.length,
      staff
    });
  } catch (error: any) {
    console.error('[FranchiseRoutes] Error listing staff:', error);
    res.status(error.status || 500).json({ success: false, error: error.message });
  }
});

// POST /api/franchises/:id/staff — Provision new staff account in franchise
router.post('/:id/staff', verifyToken, requireRole(['franchise_owner', 'owner', 'admin', 'developer']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const scope = req.user?.scope;
    if (scope) {
      FranchiseScopeService.assertFranchiseAccess(scope, id);
    }

    const { uid, email, name, phone, role, branchId, permissions, terminalId } = req.body;
    if (!name || !role) {
      res.status(400).json({ success: false, error: 'name and role are required' });
      return;
    }

    const ALLOWED_STAFF_ROLES = ['restaurant_manager', 'kitchen_staff', 'cashier', 'delivery_partner', 'franchise_manager'];
    if (!ALLOWED_STAFF_ROLES.includes(role)) {
      res.status(400).json({ success: false, error: `Invalid role. Allowed roles: ${ALLOWED_STAFF_ROLES.join(', ')}` });
      return;
    }

    const targetBranchId = branchId || 'main_branch';
    const staffUid = uid || ('staff_' + Date.now());
    const nowIso = new Date().toISOString();

    const staffPayload = {
      uid: staffUid,
      name: name.trim(),
      displayName: name.trim(),
      email: email ? email.trim().toLowerCase() : `${staffUid}@olivepizza.in`,
      phone: phone || '',
      role,
      organizationId: 'org_olive_pizza',
      franchiseId: id,
      branchId: targetBranchId,
      branchIds: [targetBranchId],
      permissions: Array.isArray(permissions) ? permissions : [],
      terminalId: terminalId || null,
      isActive: true,
      createdAt: nowIso,
      updatedAt: nowIso,
      createdBy: req.user?.email || 'franchise_owner'
    };

    await adminDb.collection('users').doc(staffUid).set(staffPayload, { merge: true });

    await FranchiseScopeService.logFranchiseAudit({
      franchiseId: id,
      branchId: targetBranchId,
      actorUid: req.user?.uid || 'unknown',
      actorEmail: req.user?.email,
      actionType: 'STAFF_CREATED',
      entityType: 'USER',
      entityId: staffUid,
      details: { role, targetBranchId, name }
    });

    res.json({
      success: true,
      message: `Staff member "${name}" created successfully with role "${role}"`,
      staff: staffPayload
    });
  } catch (error: any) {
    console.error('[FranchiseRoutes] Error creating staff:', error);
    res.status(error.status || 500).json({ success: false, error: error.message });
  }
});

// PUT /api/franchises/:id/staff/:staffId — Update staff role, branch, permissions, or active status
router.put('/:id/staff/:staffId', verifyToken, requireRole(['franchise_owner', 'owner', 'admin', 'developer']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, staffId } = req.params;
    const scope = req.user?.scope;
    if (scope) {
      FranchiseScopeService.assertFranchiseAccess(scope, id);
    }

    const staffDoc = await adminDb.collection('users').doc(staffId).get();
    if (!staffDoc.exists) {
      res.status(404).json({ success: false, error: 'Staff member not found' });
      return;
    }

    const existingData = staffDoc.data()!;
    if (existingData.franchiseId && existingData.franchiseId !== id && !scope?.isGlobalOwner) {
      res.status(403).json({ success: false, error: 'Forbidden: Staff member belongs to another franchise' });
      return;
    }

    const { name, phone, role, branchId, permissions, isActive, terminalId } = req.body;
    const nowIso = new Date().toISOString();

    const updatePayload: any = { updatedAt: nowIso, updatedBy: req.user?.email || 'franchise_owner' };
    if (name) updatePayload.name = name.trim();
    if (phone !== undefined) updatePayload.phone = phone;
    if (role) updatePayload.role = role;
    if (branchId) {
      updatePayload.branchId = branchId;
      updatePayload.branchIds = [branchId];
    }
    if (permissions && Array.isArray(permissions)) updatePayload.permissions = permissions;
    if (isActive !== undefined) updatePayload.isActive = Boolean(isActive);
    if (terminalId !== undefined) updatePayload.terminalId = terminalId;

    await adminDb.collection('users').doc(staffId).set(updatePayload, { merge: true });

    await FranchiseScopeService.logFranchiseAudit({
      franchiseId: id,
      branchId: updatePayload.branchId || existingData.branchId,
      actorUid: req.user?.uid || 'unknown',
      actorEmail: req.user?.email,
      actionType: 'STAFF_UPDATED',
      entityType: 'USER',
      entityId: staffId,
      details: updatePayload
    });

    res.json({
      success: true,
      message: `Staff member "${staffId}" updated successfully`,
      staffId,
      updates: updatePayload
    });
  } catch (error: any) {
    console.error('[FranchiseRoutes] Error updating staff:', error);
    res.status(error.status || 500).json({ success: false, error: error.message });
  }
});

// DELETE /api/franchises/:id/staff/:staffId — Deactivate staff member
router.delete('/:id/staff/:staffId', verifyToken, requireRole(['franchise_owner', 'owner', 'admin', 'developer']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id, staffId } = req.params;
    const scope = req.user?.scope;
    if (scope) {
      FranchiseScopeService.assertFranchiseAccess(scope, id);
    }

    const nowIso = new Date().toISOString();
    await adminDb.collection('users').doc(staffId).set({
      isActive: false,
      deactivatedAt: nowIso,
      deactivatedBy: req.user?.email || 'franchise_owner'
    }, { merge: true });

    await FranchiseScopeService.logFranchiseAudit({
      franchiseId: id,
      actorUid: req.user?.uid || 'unknown',
      actorEmail: req.user?.email,
      actionType: 'STAFF_DEACTIVATED',
      entityType: 'USER',
      entityId: staffId
    });

    res.json({
      success: true,
      message: `Staff member "${staffId}" deactivated successfully`,
      staffId
    });
  } catch (error: any) {
    console.error('[FranchiseRoutes] Error deactivating staff:', error);
    res.status(error.status || 500).json({ success: false, error: error.message });
  }
});

export default router;
