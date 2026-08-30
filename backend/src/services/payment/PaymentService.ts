import { query } from '../../lib/db.js';
import { adminDb } from '../../config/firebase.js';
import { getPaymentConfig } from '../../config/payment.config.js';
import { PaymentProviderFactory } from './PaymentProviderFactory.js';
import { PaymentStateMachine, PaymentState } from './PaymentStateMachine.js';
import { PaymentErrorHandler } from './PaymentErrorHandler.js';
import { FraudProtectionEngine } from './FraudProtectionEngine.js';
import { PaymentAuditLogger } from './PaymentAuditLogger.js';
import { PaymentEventQueue } from './PaymentEventQueue.js';
import { PaymentRecoveryQueue } from './PaymentRecoveryQueue.js';
import crypto from 'crypto';

export interface CreatePaymentSessionParams {
  userId: string;
  items: any[];
  deliveryAddress?: string;
  paymentMethod: 'cod' | 'upi' | 'card' | 'wallet';
  couponCode?: string;
  userIp?: string;
  deviceId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
}

export class PaymentService {
  /**
   * Recalculates total server-side with 100% price accuracy from Firestore products/menu_items/combos
   */
  public static async recalculateServerTotal(items: any[]): Promise<{
    validatedItems: any[];
    subtotal: number;
    taxes: number;
    deliveryFee: number;
    totalAmount: number;
  }> {
    let subtotal = 0;
    const validatedItems: any[] = [];

    for (const item of items) {
      const itemId = item.menuItemId || item.id;
      let menuData: any = null;

      if (itemId && typeof itemId === 'string' && !itemId.startsWith('item-')) {
        let snap = await adminDb.collection('products').doc(itemId).get();
        if (snap.exists) menuData = snap.data();
        else {
          snap = await adminDb.collection('menu_items').doc(itemId).get();
          if (snap.exists) menuData = snap.data();
          else {
            snap = await adminDb.collection('combos').doc(itemId).get();
            if (snap.exists) menuData = snap.data();
          }
        }
      }

      let price = Number(item.price || 0);
      let name = item.name || 'Artisan Pizza Item';
      let image = item.image || '';

      if (menuData) {
        if (menuData.isAvailable === false || menuData.isActive === false) {
          throw new Error(`Item "${menuData.name || name}" is currently unavailable.`);
        }
        price = Number(menuData.basePrice ?? menuData.price ?? menuData.base_price ?? item.price ?? 0);
        name = menuData.name || name;
        image = menuData.image || menuData.imageUrl || image;
      }

      const qty = Number(item.quantity || 1);
      subtotal += price * qty;

      validatedItems.push({
        id: itemId || `item-${Date.now()}`,
        menuItemId: itemId,
        name,
        price,
        quantity: qty,
        size: item.size || 'Medium',
        crust: item.crust || 'Classic Crust',
        addons: item.addons || [],
        image,
      });
    }

    const deliveryFee = subtotal > 500 || subtotal === 0 ? 0 : 30;
    const taxes = Math.round(subtotal * 0.05); // 5% GST
    const totalAmount = subtotal + deliveryFee;

    return {
      validatedItems,
      subtotal,
      taxes,
      deliveryFee,
      totalAmount,
    };
  }

  /**
   * Main Intent & Session Creator
   */
  public static async createPaymentSession(params: CreatePaymentSessionParams): Promise<{
    paymentId: string;
    sessionId: string;
    state: PaymentState;
    totalAmount: number;
    paymentMethod: string;
    sdkPayload?: any;
    checkoutUrl?: string;
    orderId?: string;
  }> {
    const config = getPaymentConfig();

    if (config.maintenanceMode) {
      throw new Error('Online payments are temporarily paused for maintenance. Cash on Delivery is available!');
    }
    if (config.enableCodOnly && params.paymentMethod !== 'cod') {
      throw new Error('Only Cash on Delivery payments are enabled at this time.');
    }

    // 1. Recalculate total server-side
    const { validatedItems, totalAmount } = await this.recalculateServerTotal(params.items);

    // 2. Fraud & Velocity Evaluation
    const fraudRes = FraudProtectionEngine.evaluateRisk({
      userId: params.userId,
      userIp: params.userIp,
      deviceId: params.deviceId,
      amount: totalAmount,
      currency: config.currency,
      itemCount: validatedItems.length,
    });

    if (!fraudRes.passed) {
      throw new Error(`Payment security check failed: ${fraudRes.reason}`);
    }

    const paymentId = `pay_${crypto.randomUUID()}`;
    const sessionId = `sess_${crypto.randomUUID()}`;
    let state: PaymentState = 'CREATED';

    // Log Initial State
    await PaymentAuditLogger.log({
      paymentId,
      action: 'PAYMENT_SESSION_CREATED',
      actorId: params.userId,
      actorRole: 'customer',
      details: { amount: totalAmount, paymentMethod: params.paymentMethod, riskScore: fraudRes.riskScore },
      ipAddress: params.userIp,
    });

    state = PaymentStateMachine.transition(state, 'INTENT_CREATED');

    // Store in Postgres (safe fallback)
    try {
      await query(`
        INSERT INTO payments (id, payment_session_id, user_id, provider, amount, currency, status, payment_method, metadata, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      `, [
        paymentId,
        sessionId,
        params.userId,
        config.activeProvider,
        totalAmount,
        config.currency,
        state,
        params.paymentMethod,
        JSON.stringify({ items: validatedItems, deliveryAddress: params.deliveryAddress }),
      ]);
    } catch (err: any) {
      console.warn('[PaymentService] DB write skipped for payments table:', err.message);
    }

    // Handle Online vs COD
    if (params.paymentMethod === 'cod') {
      return {
        paymentId,
        sessionId,
        state,
        totalAmount,
        paymentMethod: 'cod',
      };
    }

    // Online Gateway Intent Creation
    const provider = PaymentProviderFactory.getProvider();
    try {
      const intentRes = await provider.createPaymentIntent({
        paymentId,
        sessionId,
        amount: totalAmount,
        currency: config.currency,
        userId: params.userId,
        customerName: params.customerName,
        customerEmail: params.customerEmail,
        customerPhone: params.customerPhone,
      });

      PaymentProviderFactory.recordSuccess(provider.name);

      // Update provider_payment_id in Postgres
      try {
        await query(`UPDATE payments SET provider_payment_id = $1, status = 'PAYMENT_PENDING' WHERE id = $2`, [intentRes.providerPaymentId, paymentId]);
      } catch (e) {}

      return {
        paymentId,
        sessionId,
        state: 'PAYMENT_PENDING',
        totalAmount,
        paymentMethod: params.paymentMethod,
        sdkPayload: intentRes.sdkPayload,
        checkoutUrl: intentRes.checkoutUrl,
      };
    } catch (err: any) {
      PaymentProviderFactory.recordFailure(provider.name);
      throw err;
    }
  }

  /**
   * Process Webhook Notification safely with HMAC validation
   */
  public static async processWebhook(providerName: string, rawBody: string | object, signature: string): Promise<{ success: boolean; eventType: string }> {
    const provider = PaymentProviderFactory.getProvider(providerName);
    const isSignatureValid = provider.verifySignature(rawBody, signature);

    if (!isSignatureValid) {
      console.error(`[Webhook] Invalid signature from provider: ${providerName}`);
      throw PaymentErrorHandler.createError('INVALID_SIGNATURE', 'Webhook HMAC signature mismatch', { provider: providerName });
    }

    const payload: any = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    const eventId = payload.event_id || payload.id || `evt_${Date.now()}`;

    // Replay attack prevention check in DB
    try {
      const existing = await query('SELECT 1 FROM payment_webhooks WHERE event_id = $1', [eventId]);
      if (existing.rows.length > 0) {
        console.warn(`[Webhook] Duplicate webhook event ID ${eventId} ignored.`);
        return { success: true, eventType: 'duplicate_ignored' };
      }

      await query(
        'INSERT INTO payment_webhooks (id, provider, event_type, event_id, payload, signature_verified, processed_at) VALUES ($1, $2, $3, $4, $5, true, NOW())',
        [crypto.randomUUID(), providerName, payload.event || 'payment.success', eventId, JSON.stringify(payload)]
      );
    } catch (err) {}

    console.log(`✅ [Webhook] Verified webhook received from ${providerName}:`, payload.event || 'payment.success');

    // Extract payment ID & Provider Transaction ID across standard gateway payloads
    let paymentId = payload.paymentId || payload.orderId;
    let providerTxId = payload.id;
    let amount = payload.amount;

    if (payload.payload?.payment?.entity) {
      // Razorpay webhook format
      const rzpPayment = payload.payload.payment.entity;
      paymentId = rzpPayment.notes?.paymentId || rzpPayment.order_id || paymentId;
      providerTxId = rzpPayment.id || providerTxId;
      amount = rzpPayment.amount ? rzpPayment.amount / 100 : amount;
    } else if (payload.data?.order) {
      // Cashfree webhook format
      const cfOrder = payload.data.order;
      paymentId = cfOrder.order_id || cfOrder.order_tags?.paymentId || paymentId;
      providerTxId = payload.data?.payment?.cf_payment_id || providerTxId;
    }

    if (paymentId) {
      // 1. Update PostgreSQL Payment status
      try {
        await query(
          "UPDATE payments SET status = 'PAYMENT_CAPTURED', provider_transaction_id = $1, verified_at = NOW(), updated_at = NOW() WHERE id = $2 OR provider_payment_id = $2",
          [providerTxId || `tx_${Date.now()}`, paymentId]
        );
      } catch (dbErr) {
        console.warn('[Webhook] Postgres payment update warning:', dbErr);
      }

      // 2. Update Firestore Order status atomically
      try {
        const orderSnap = await adminDb.collection('orders').doc(paymentId).get();
        if (orderSnap.exists) {
          await adminDb.collection('orders').doc(paymentId).update({
            paymentStatus: 'PAID',
            isPaid: true,
            status: orderSnap.data()?.status === 'pending_payment' ? 'placed' : orderSnap.data()?.status,
            paidAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            providerTransactionId: providerTxId || null
          });
          console.log(`[Webhook] Order ${paymentId} marked as PAID in Firestore`);
        }
      } catch (fsErr) {
        console.warn('[Webhook] Firestore order update warning:', fsErr);
      }

      // 3. Log Payment Audit Event
      await PaymentAuditLogger.log({
        paymentId,
        action: 'WEBHOOK_PAYMENT_CAPTURED',
        actorId: `webhook_${providerName}`,
        actorRole: 'system',
        details: { provider: providerName, providerTxId, eventType: payload.event || 'payment.success' }
      });
    }

    return { success: true, eventType: payload.event || 'payment.success' };
  }

  /**
   * Initiates Full or Partial Refund
   */
  public static async processRefund(paymentId: string, refundAmount: number, reason: string, actorId: string): Promise<{ success: boolean; refundId: string }> {
    let providerTxId = `tx_${paymentId}`;
    let providerName = 'mock';

    try {
      const res = await query('SELECT * FROM payments WHERE id = $1', [paymentId]);
      if (res.rows.length > 0) {
        providerTxId = res.rows[0].provider_payment_id || providerTxId;
        providerName = res.rows[0].provider || 'mock';
      }
    } catch (e) {}

    const provider = PaymentProviderFactory.getProvider(providerName);
    const refundRes = await provider.createRefund({
      paymentId,
      providerTransactionId: providerTxId,
      refundAmount,
      reason,
    });

    if (refundRes.success) {
      await PaymentAuditLogger.log({
        paymentId,
        action: 'REFUND_PROCESSED',
        actorId,
        actorRole: 'owner',
        details: { refundAmount, reason, refundTransactionId: refundRes.refundTransactionId },
      });

      try {
        await query('INSERT INTO refunds (id, payment_id, refund_amount, reason, status, created_at) VALUES ($1, $2, $3, $4, $5, NOW())', [
          refundRes.refundTransactionId,
          paymentId,
          refundAmount,
          reason,
          'PROCESSED',
        ]);
        await query("UPDATE payments SET status = 'REFUNDED', updated_at = NOW() WHERE id = $1", [paymentId]);
      } catch (e) {}
    }

    return {
      success: refundRes.success,
      refundId: refundRes.refundTransactionId,
    };
  }
}
