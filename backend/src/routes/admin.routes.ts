import { Router, Request, Response } from 'express';
import { adminDb } from '../config/firebase.js';
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

// ─── User Roles ──────────────────────────────────────────────────────────────
import { adminAuth } from '../config/firebase.js';
const ADMIN_VALID_ROLES = ['customer', 'delivery_partner', 'cashier', 'kitchen_staff', 'restaurant_manager', 'franchise_owner', 'admin', 'owner'];

router.put('/users/:id/role', async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.body;
    if (!role || !ADMIN_VALID_ROLES.includes(role)) {
      res.status(400).json({ error: `Invalid role '${role}'. Allowed roles: ${ADMIN_VALID_ROLES.join(', ')}` });
      return;
    }
    await adminDb.collection('users').doc(req.params.id).update({ role });
    await adminAuth.setCustomUserClaims(req.params.id, { role });
    res.json({ success: true, role });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

export default router;
