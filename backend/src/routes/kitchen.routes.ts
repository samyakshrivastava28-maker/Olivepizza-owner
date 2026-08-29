import { Router, Response } from 'express';
import { verifyToken, AuthRequest } from '../middleware/auth.middleware.js';
import { KitchenInventoryService } from '../services/kitchen/KitchenInventoryService.js';

const router = Router();

// Allowed roles for Kitchen Management
const ALLOWED_ROLES = [
  'owner',
  'admin',
  'developer',
  'franchise_owner',
  'restaurant_manager',
  'manager',
  'kitchen_staff',
  'staff',
];

const requireKitchenAccess = (req: AuthRequest, res: Response, next: Function) => {
  const role = req.user?.role || '';
  if (!ALLOWED_ROLES.includes(role) && !['olivepizzarjn@gmail.com', 'webhub2811@gmail.com'].includes(req.user?.email?.toLowerCase() || '')) {
    res.status(403).json({ success: false, error: 'Forbidden: Insufficient permissions for Kitchen Management' });
    return;
  }
  next();
};

/**
 * GET /api/kitchen/inventory
 * List items for authorized branch
 */
router.get('/inventory', verifyToken, requireKitchenAccess, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const branchId = (req.query.branchId as string) || req.user?.branchId || 'main_branch';
    const category = req.query.category as string;
    const status = req.query.status as string;

    const items = await KitchenInventoryService.listItems(branchId, { category, status });
    res.json({ success: true, items, count: items.length });
  } catch (error: any) {
    console.error('[KitchenRoutes] Failed to list inventory:', error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to list inventory' });
  }
});

/**
 * POST /api/kitchen/inventory
 * Create a new inventory item
 */
router.post('/inventory', verifyToken, requireKitchenAccess, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, category, unit, availableQuantity, minimumQuantity, description } = req.body;

    if (!name || !category || !unit) {
      res.status(400).json({ success: false, error: 'Name, category, and unit are required' });
      return;
    }

    const branchId = req.body.branchId || req.user?.branchId || 'main_branch';
    const franchiseId = req.body.franchiseId || req.user?.franchiseId || 'default_franchise';
    const userId = req.user?.uid || 'anonymous';
    const userName = req.user?.email || 'Restaurant Staff';

    const item = await KitchenInventoryService.createItem(
      {
        name,
        category,
        unit,
        availableQuantity: Number(availableQuantity) || 0,
        minimumQuantity: Number(minimumQuantity) || 0,
        description,
        branchId,
        franchiseId,
      },
      userId,
      userName
    );

    res.status(201).json({ success: true, item });
  } catch (error: any) {
    console.error('[KitchenRoutes] Failed to create item:', error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to create inventory item' });
  }
});

/**
 * POST /api/kitchen/inventory/:itemId/adjust
 * Adjust stock quantity (+, -, or set)
 */
router.post('/inventory/:itemId/adjust', verifyToken, requireKitchenAccess, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { itemId } = req.params;
    const { delta, changeType, reason } = req.body;

    if (delta === undefined || !changeType) {
      res.status(400).json({ success: false, error: 'delta and changeType (add, remove, set) are required' });
      return;
    }

    const branchId = req.body.branchId || req.user?.branchId || 'main_branch';
    const franchiseId = req.body.franchiseId || req.user?.franchiseId || 'default_franchise';
    const userId = req.user?.uid || 'anonymous';
    const userName = req.user?.email || 'Staff';

    const updatedItem = await KitchenInventoryService.adjustStock(
      itemId,
      Number(delta),
      changeType,
      reason,
      userId,
      userName,
      branchId,
      franchiseId
    );

    res.json({ success: true, item: updatedItem });
  } catch (error: any) {
    console.error('[KitchenRoutes] Failed to adjust stock:', error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to adjust stock' });
  }
});

/**
 * PATCH /api/kitchen/inventory/:itemId
 * Update item metadata
 */
router.patch('/inventory/:itemId', verifyToken, requireKitchenAccess, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { itemId } = req.params;
    const branchId = req.body.branchId || req.user?.branchId || 'main_branch';
    const userId = req.user?.uid || 'anonymous';
    const userName = req.user?.email || 'Staff';

    const updated = await KitchenInventoryService.updateItem(itemId, req.body, userId, userName, branchId);
    res.json({ success: true, item: updated });
  } catch (error: any) {
    console.error('[KitchenRoutes] Failed to update item:', error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to update item' });
  }
});

/**
 * DELETE /api/kitchen/inventory/:itemId
 * Soft delete / Archive item
 */
router.delete('/inventory/:itemId', verifyToken, requireKitchenAccess, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { itemId } = req.params;
    const branchId = (req.query.branchId as string) || req.user?.branchId || 'main_branch';
    const userId = req.user?.uid || 'anonymous';

    await KitchenInventoryService.archiveItem(itemId, userId, branchId);
    res.json({ success: true, message: 'Item archived successfully' });
  } catch (error: any) {
    console.error('[KitchenRoutes] Failed to archive item:', error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to archive item' });
  }
});

/**
 * GET /api/kitchen/history
 * Stock adjustment history log
 */
router.get('/history', verifyToken, requireKitchenAccess, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const branchId = (req.query.branchId as string) || req.user?.branchId || 'main_branch';
    const limit = Number(req.query.limit) || 50;

    const history = await KitchenInventoryService.getHistory(branchId, limit);
    res.json({ success: true, history, count: history.length });
  } catch (error: any) {
    console.error('[KitchenRoutes] Failed to fetch history:', error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to fetch inventory history' });
  }
});

/**
 * GET /api/kitchen/stats
 * Quick summary statistics
 */
router.get('/stats', verifyToken, requireKitchenAccess, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const branchId = (req.query.branchId as string) || req.user?.branchId || 'main_branch';
    const items = await KitchenInventoryService.listItems(branchId);

    const inStock = items.filter(i => i.status === 'IN_STOCK').length;
    const lowStock = items.filter(i => i.status === 'LOW_STOCK').length;
    const outOfStock = items.filter(i => i.status === 'OUT_OF_STOCK').length;

    res.json({
      success: true,
      stats: {
        totalItems: items.length,
        inStock,
        lowStock,
        outOfStock,
      }
    });
  } catch (error: any) {
    console.error('[KitchenRoutes] Failed to get stats:', error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to get inventory stats' });
  }
});

export default router;