import { Router, Response } from 'express';
import { OrderHistorySearchService, OrderSearchRequest } from '../services/order-history/OrderHistorySearchService.js';
import { OrderArchiveIndexer } from '../services/order-history/OrderArchiveIndexer.js';
import { ZillizOrderRepository } from '../services/order-history/ZillizOrderRepository.js';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth.middleware.js';

const router = Router();

// 1. Search All-Time Order History (Owner/Admin protected)
router.post(
  '/search',
  verifyToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { query, filters, pagination } = req.body;
      const user = req.user;

      const callerScope = {
        role: user?.role || 'owner',
        franchiseId: user?.franchiseId || user?.organizationId,
        branchId: user?.branchId
      };

      const searchRequest: OrderSearchRequest = {
        query,
        filters,
        pagination,
        callerScope
      };

      const result = await OrderHistorySearchService.search(searchRequest);
      res.json({
        success: true,
        data: result
      });
    } catch (err: any) {
      console.error('[OwnerOrderHistoryAPI] Search error:', err.message);
      res.status(500).json({
        success: false,
        error: 'Failed to execute order history search: ' + err.message
      });
    }
  }
);

// 2. Index Single Order Manually (Admin/Owner)
router.post(
  '/index-order',
  verifyToken,
  requireRole(['owner', 'admin']),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { order } = req.body;
      if (!order) {
        res.status(400).json({ success: false, error: 'Order payload is required' });
        return;
      }

      const success = await OrderArchiveIndexer.indexSingleOrder(order);
      res.json({
        success,
        message: success ? 'Order indexed successfully into Zilliz' : 'Failed to index order'
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// 3. Batch Backfill Historical Orders (Owner/Admin)
router.post(
  '/backfill',
  verifyToken,
  requireRole(['owner', 'admin']),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const limit = parseInt(req.body.limit, 10) || 50;
      const result = await OrderArchiveIndexer.backfillHistoricalOrders(limit);
      res.json({
        success: true,
        data: result,
        message: 'Backfilled ' + result.indexed + ' orders (' + result.failed + ' failed)'
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// 4. Status & Vector Index Health
router.get(
  '/status',
  verifyToken,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const status = await ZillizOrderRepository.getStatus();
      res.json({
        success: true,
        data: status
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

export default router;
