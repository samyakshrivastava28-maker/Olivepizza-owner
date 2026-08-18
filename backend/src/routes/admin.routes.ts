import { Router, Request, Response } from 'express';
import { adminDb } from '../config/firebase.js';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth.middleware.js';
import kb from '../services/KnowledgeBaseService.js';

const router = Router();

router.use(verifyToken);
router.use(requireRole(['owner', 'admin']));

// ─── Products CRUD ──────────────────────────────────────────────────────────
router.post('/products', async (req: AuthRequest, res: Response) => {
  try {
    const data = {
      ...req.body,
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
    const data = {
      ...req.body,
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
    const data = { ...req.body, createdAt: new Date().toISOString() };
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
    const data = { ...req.body, updatedAt: new Date().toISOString() };
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
    const data = { ...req.body, createdAt: new Date().toISOString() };
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
    const data = { ...req.body, updatedAt: new Date().toISOString() };
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
    await adminDb.collection('settings').doc(req.params.id).set(req.body, { merge: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ─── User Roles ──────────────────────────────────────────────────────────────
import { adminAuth } from '../config/firebase.js';
router.put('/users/:id/role', async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.body;
    await adminDb.collection('users').doc(req.params.id).update({ role });
    await adminAuth.setCustomUserClaims(req.params.id, { role });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

export default router;
