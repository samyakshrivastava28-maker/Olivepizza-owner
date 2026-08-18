import { Router, Request, Response } from 'express';
import { PaymentService } from '../services/payment/PaymentService.js';
import { PaymentHealthMonitor } from '../services/payment/PaymentHealthMonitor.js';
import { PaymentReportingService } from '../services/payment/PaymentReportingService.js';
import { InvoiceEngine } from '../services/payment/InvoiceEngine.js';
import { getPaymentConfig, updatePaymentConfig } from '../config/payment.config.js';
import { optionalAuth, verifyToken, requireRole, AuthRequest } from '../middleware/auth.middleware.js';
import { query } from '../lib/db.js';
import { adminDb } from '../config/firebase.js';

const router = Router();

// ─── 1. Create Payment Intent / Session ─────────────────────────────────────────
router.post('/create-intent', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { items, deliveryAddress, paymentMethod, couponCode, customerName, customerPhone, customerEmail } = req.body;
    const userId = req.user?.uid || 'guest-user';
    const userIp = (req.headers['x-forwarded-for'] as string) || req.ip || '127.0.0.1';
    const deviceId = (req.headers['x-device-id'] as string) || 'unknown-device';

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Cart items are required' });
      return;
    }

    const sessionRes = await PaymentService.createPaymentSession({
      userId,
      items,
      deliveryAddress,
      paymentMethod: paymentMethod || 'cod',
      couponCode,
      userIp,
      deviceId,
      customerName: customerName || (req.user as any)?.name || 'Gourmet Customer',
      customerPhone: customerPhone || (req.user as any)?.phone || '',
      customerEmail: customerEmail || (req.user as any)?.email || '',
    });

    res.json({
      success: true,
      ...sessionRes,
    });
  } catch (error: any) {
    console.error('[PaymentRoute] Error in /create-intent:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// ─── 2. Client Payment Verification Callback ──────────────────────────────────
router.post('/verify', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { paymentId, providerPaymentId, providerSignature, providerTransactionId } = req.body;
    const config = getPaymentConfig();

    const providerName = config.activeProvider;
    const provider = (await import('../services/payment/PaymentProviderFactory.js')).PaymentProviderFactory.getProvider(providerName);

    const verifyResult = await provider.verifyPayment({
      paymentId,
      providerPaymentId,
      providerSignature,
      providerTransactionId,
    });

    if (verifyResult.verified) {
      try {
        await query("UPDATE payments SET status = 'PAYMENT_CAPTURED', verified_at = NOW() WHERE id = $1", [paymentId]);
      } catch (e) {}

      res.json({
        success: true,
        verified: true,
        status: verifyResult.status,
        providerPaymentId: verifyResult.providerPaymentId,
        providerTransactionId: verifyResult.providerTransactionId,
      });
    } else {
      res.status(400).json({
        success: false,
        verified: false,
        error: verifyResult.errorReason || 'Payment verification failed',
      });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── 3. Provider Webhook Listener (HMAC Signature Verified) ───────────────────
router.post('/webhook/:provider', async (req: Request, res: Response) => {
  try {
    const providerName = req.params.provider;
    const signature = (req.headers['x-razorpay-signature'] ||
      req.headers['x-verify'] ||
      req.headers['x-cashfree-signature'] ||
      req.headers['signature']) as string;

    const result = await PaymentService.processWebhook(providerName, req.body, signature || '');
    res.json({ received: true, ...result });
  } catch (error: any) {
    console.error('[WebhookRoute] Webhook processing failed:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// ─── 4. Customer Payment History ──────────────────────────────────────────────
router.get('/history', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const dbRes = await query('SELECT * FROM payments WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20', [userId]);
      res.json(dbRes.rows);
    } catch (e) {
      // Fallback from Firestore orders if postgres unavailable
      const snap = await adminDb.collection('orders').where('userId', '==', userId).orderBy('createdAt', 'desc').limit(10).get();
      const history = snap.docs.map((doc) => ({
        id: doc.id,
        orderId: doc.id,
        amount: doc.data().totalAmount,
        status: doc.data().status === 'delivered' ? 'COMPLETED' : 'ORDER_CREATED',
        payment_method: doc.data().paymentMethod || 'cod',
        created_at: doc.data().createdAt,
      }));
      res.json(history);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── 5. Invoice Generator HTML/PDF ────────────────────────────────────────────
router.get('/invoice/:orderId', async (req: Request, res: Response) => {
  try {
    const orderId = req.params.orderId;
    let orderData: any = null;

    const docSnap = await adminDb.collection('orders').doc(orderId).get();
    if (docSnap.exists) {
      orderData = docSnap.data();
    }

    const html = InvoiceEngine.generateInvoiceHtml({
      orderId,
      paymentId: orderData?.paymentId || `pay_${orderId.slice(0, 8)}`,
      customerName: orderData?.contactName || 'Gourmet Customer',
      customerPhone: orderData?.contactPhone || '',
      customerAddress: orderData?.deliveryAddress?.addressLine || orderData?.deliveryAddress || 'Rajnandgaon, CG',
      items: orderData?.items || [{ name: 'Artisan Pizza Special', quantity: 1, price: orderData?.totalAmount || 299 }],
      totalAmount: Number(orderData?.totalAmount || 299),
      paymentMethod: orderData?.paymentMethod || 'cod',
      createdAt: orderData?.createdAt ? new Date(orderData.createdAt).toISOString() : new Date().toISOString(),
    });

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error: any) {
    res.status(500).send(`<h2>Invoice Generation Error: ${error.message}</h2>`);
  }
});

// ─── 6. Owner Refund Endpoint ──────────────────────────────────────────────────
router.post('/refund', verifyToken, requireRole(['owner', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { paymentId, amount, reason } = req.body;
    if (!paymentId || !amount) {
      res.status(400).json({ error: 'paymentId and amount are required' });
      return;
    }

    const refundRes = await PaymentService.processRefund(paymentId, Number(amount), reason || 'Customer request', req.user?.uid || 'owner');
    res.json(refundRes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── 7. Owner Financial Reports & CSV Export ───────────────────────────────────
router.get('/reports', verifyToken, requireRole(['owner', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const period = (req.query.period as 'daily' | 'weekly' | 'monthly') || 'daily';
    const format = req.query.format as string;

    const report = await PaymentReportingService.generateReport(period);

    if (format === 'csv') {
      const csv = PaymentReportingService.exportReportCsv(report);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=financial_report_${period}_${Date.now()}.csv`);
      res.send(csv);
    } else {
      res.json(report);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── 8. Developer Telemetry & Payment Diagnostics ─────────────────────────────
router.get('/diagnostics', verifyToken, requireRole(['owner', 'admin', 'developer']), async (_req: Request, res: Response) => {
  try {
    const config = getPaymentConfig();
    const health = await PaymentHealthMonitor.checkAllHealth();

    res.json({
      config: {
        activeProvider: config.activeProvider,
        sandboxMode: config.sandboxMode,
        maintenanceMode: config.maintenanceMode,
        disableOnlinePayments: config.disableOnlinePayments,
        enableCodOnly: config.enableCodOnly,
        currency: config.currency,
        maxOrderAmount: config.maxOrderAmount,
        businessName: config.businessName,
      },
      health,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─── 9. Developer Dynamic Config Update (Hot Reload) ─────────────────────────
router.put('/config', verifyToken, requireRole(['owner', 'admin', 'developer']), async (req: AuthRequest, res: Response) => {
  try {
    const updated = updatePaymentConfig(req.body);
    res.json({ success: true, config: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
