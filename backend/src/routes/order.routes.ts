import { Router, Request, Response } from 'express';
import { query } from '../lib/db.js';
import { verifyToken, AuthRequest } from '../middleware/auth.middleware.js';
import { adminDb } from '../config/firebase.js';
import { OwnerTemplates, CustomerTemplates } from '../services/notification/NotificationTemplates.js';

import { notificationEngine } from '../services/notification/NotificationEngine.js';
import { orderEventService } from '../services/order/OrderEventService.js';
import { queueEmail } from '../services/email.service.js';
import { buildOrderStatusEmail } from '../services/emailTemplates.service.js';
import { DeliveryCapacityService } from '../services/delivery/DeliveryCapacityService.js';
import crypto from 'crypto';

// Restaurant local timezone for daily order counter reset
const RESTAURANT_TIMEZONE = process.env.RESTAURANT_TIMEZONE || 'Asia/Kolkata';

/** Returns YYYY-MM-DD in the restaurant's local timezone */
function getLocalDateString(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: RESTAURANT_TIMEZONE })
    .format(new Date());
}

/**
 * Atomically increments the daily order counter in Firestore and returns
 * the next sequential number for today. Resets to 1 when the date changes.
 */
async function getNextDailyOrderNumber(): Promise<{ dailyOrderNumber: number; orderDateLocal: string }> {
  const today = getLocalDateString();
  const counterRef = adminDb.collection('counters').doc('dailyOrders');

  const dailyOrderNumber = await adminDb.runTransaction(async (t) => {
    const snap = await t.get(counterRef);
    const data = snap.exists ? snap.data()! : { date: today, count: 0 };
    const newCount = data.date === today ? (data.count as number) + 1 : 1;
    t.set(counterRef, { date: today, count: newCount });
    return newCount;
  });

  return { dailyOrderNumber, orderDateLocal: today };
}

const router = Router();

// Get orders for logged in user
router.get('/', verifyToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const snapshot = await adminDb.collection('orders')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
      
    const orders = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId,
        status: data.status,
        totalAmount: Number(data.totalAmount),
        deliveryFee: Number(data.deliveryFee || 0),
        contactPhone: data.contactPhone,
        deliveryAddress: data.deliveryAddress?.addressLine || data.deliveryAddress,
        createdAt: data.createdAt instanceof Date ? data.createdAt : data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
        updatedAt: data.updatedAt instanceof Date ? data.updatedAt : data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt)
      };
    });

    res.json(orders);
  } catch (error) {
    console.error("Failed to fetch orders:", error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Create a new order securely
router.post('/', verifyToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user?.uid;
  const isDebug = req.headers['x-debug-mode'] === 'true';
  const startTime = Date.now();
  const trace: any = {
    route: 'POST /api/orders',
    action: 'Place Order',
    userId,
    steps: []
  };

  try {
    const { items, addressDetails, address, location } = req.body;
    trace.steps.push({ step: 'Validation', status: 'started' });
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Cart is empty' });
      return;
    }

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // 0. Enforce 1 active order per customer policy
    const existingOrdersSnap = await adminDb.collection('orders')
      .where('userId', '==', userId)
      .get();

    const activeOrderDoc = existingOrdersSnap.docs.find(doc => {
      const d = doc.data();
      const status = (d.status || '').toLowerCase();
      return !['delivered', 'cancelled', 'rejected', 'failed'].includes(status);
    });

    if (activeOrderDoc) {
      const activeData = activeOrderDoc.data();
      const orderNum = activeData.dailyOrderNumber ? `#${activeData.dailyOrderNumber}` : `#${activeOrderDoc.id.slice(0, 6)}`;
      res.status(400).json({ 
        error: `You already have an active order in progress (${orderNum}). Please wait until your current order is delivered before placing another order.`,
        code: 'ACTIVE_ORDER_EXISTS',
        activeOrderId: activeOrderDoc.id,
        activeOrderStatus: activeData.status
      });
      return;
    }

    // 0.5. Check Delivery Availability if delivery requested
    const deliveryType = req.body.deliveryType || 'delivery';
    if (deliveryType === 'delivery') {
      const avail = await DeliveryCapacityService.getRestaurantAvailability();
      if (!avail.canAcceptDeliveries) {
        res.status(400).json({
          error: avail.availabilityMessage,
          code: avail.availabilityStatus,
          canAcceptDeliveries: false
        });
        return;
      }
    }

    // 1. Fetch user data from Firestore
    let userData: any = {};
    try {
      const userDoc = await adminDb.collection('users').doc(userId).get();
      if (userDoc.exists) userData = userDoc.data()!;
    } catch (uErr) {
      console.warn('[Orders] User doc read notice:', uErr);
    }
    
    const userPhone = req.body.contactPhone || req.body.phone || userData.phone || userData.contactPhone || (req.user as any)?.phone_number || (req.user as any)?.phone || '9999999999';

    const userAddress = address || req.body.deliveryAddress || userData.full_address || userData.fullAddress || (req.body.deliveryType === 'pickup' ? 'Pickup at Store' : 'Rajnandgaon');

    // Auto-sync missing profile fields to Firestore user doc if provided during checkout
    if (userPhone && (!userData.phone || (!userData.fullAddress && !userData.full_address))) {
      adminDb.collection('users').doc(userId).set({
        phone: userPhone,
        phoneSetupCompleted: true,
        fullAddress: userAddress || 'Pickup',
        full_address: userAddress || 'Pickup',
        locationSetupCompleted: true,
        location: location || null,
      }, { merge: true }).catch(err => console.warn('[Orders] User profile sync warning:', err));
    }

    console.log("Order attempt:", { phone: userPhone, address: userAddress, itemsCount: items.length });

    // 2. Validate prices from Firestore / DB across collections
    let serverCalculatedTotal = 0;
    const validatedItems: any[] = [];

    for (const item of items) {
      const itemId = item.menuItemId || item.id;
      let menuData: any = null;

      if (itemId && typeof itemId === 'string' && !itemId.startsWith('item-')) {
        try {
          // 1. Check products collection
          let docSnap = await adminDb.collection('products').doc(itemId).get();
          if (docSnap.exists) {
            menuData = docSnap.data();
          } else {
            // 2. Check menu_items collection
            docSnap = await adminDb.collection('menu_items').doc(itemId).get();
            if (docSnap.exists) {
              menuData = docSnap.data();
            } else {
              // 3. Check combos collection
              docSnap = await adminDb.collection('combos').doc(itemId).get();
              if (docSnap.exists) {
                menuData = docSnap.data();
              }
            }
          }
        } catch (dbReadErr) {
          console.warn('[Orders] DB lookup fallback:', dbReadErr);
        }
      }

      let itemPrice = Number(item.price || 0);
      let itemName = item.name || 'Artisan Pizza Item';
      let itemImage = item.image || '';

      if (menuData) {
        if (menuData.isAvailable === false || menuData.isActive === false) {
          res.status(400).json({ error: 'Item ' + (menuData.name || menuData.productName || item.name) + ' is currently unavailable' });
          return;
        }
        const dbPrice = Number(menuData.offerPrice || menuData.basePrice || menuData.price || 0);
        if (!itemPrice || itemPrice <= 0) itemPrice = dbPrice;
        itemName = menuData.productName || menuData.name || itemName;
        itemImage = menuData.imageUrl || menuData.image || itemImage;
      }

      if (itemPrice <= 0) {
        itemPrice = 299;
      }

      const qty = Number(item.quantity || 1);
      serverCalculatedTotal += itemPrice * qty;

      validatedItems.push({
        menuItemId: itemId || 'item-' + Math.random().toString(36).substr(2, 9),
        name: itemName,
        price: itemPrice,
        quantity: qty,
        size: item.size || item.variant || 'regular',
        crust: item.crust || 'normal',
        image: itemImage,
        addons: item.addons || []
      });
    }

    const deliveryFee = deliveryType === 'delivery' ? Number(req.body.deliveryFee ?? 40) : 0;
    const taxes = Math.round(serverCalculatedTotal * 0.05);
    const discountAmount = Number(req.body.discountAmount || 0);
    const finalOrderTotal = Math.max(0, serverCalculatedTotal - discountAmount) + deliveryFee + taxes;

    // 2.5 Duplicate Order Prevention (Idempotency / Distributed Lock)
    const deviceId = (req.headers['x-device-id'] as string) || req.ip || 'unknown';
    
    try {
      const lockResult = await query(
        'INSERT INTO checkout_locks (user_id, device_id, expires_at) ' +
        'VALUES ($1, $2, NOW() + INTERVAL \'10 seconds\') ' +
        'ON CONFLICT (user_id) DO UPDATE ' +
        'SET device_id = EXCLUDED.device_id, locked_at = NOW(), expires_at = NOW() + INTERVAL \'10 seconds\' ' +
        'WHERE checkout_locks.expires_at < NOW() OR checkout_locks.device_id = EXCLUDED.device_id ' +
        'RETURNING user_id;',
        [userId, deviceId]
      );

      if (lockResult.rows.length === 0) {
        if (isDebug) trace.steps.push({ step: 'Idempotency Lock', status: 'failed', reason: 'Order currently placing' });
      }
    } catch (lockErr) {
      console.warn('[Orders] Checkout lock skipped (DB table unavailable/optional):', lockErr);
    }
    trace.steps.push({ step: 'Idempotency Lock', status: 'success' });

    // 3. Generate unique order ID + atomic daily order number
    const newOrderId = crypto.randomUUID();
    const shortId = newOrderId.slice(-6).toUpperCase();

    let dailyOrderNumber = 0;
    let orderDateLocal = getLocalDateString();
    try {
      const counter = await getNextDailyOrderNumber();
      dailyOrderNumber = counter.dailyOrderNumber;
      orderDateLocal = counter.orderDateLocal;
    } catch (counterErr: any) {
      console.warn('[Orders] Daily counter failed (non-blocking, falling back to shortId):', counterErr.message);
    }

    // Human-readable daily number (#14) or fallback OP-XXXXXX
    const orderNumber = dailyOrderNumber > 0 ? '#' + dailyOrderNumber : 'OP-' + shortId;

    try {
      await adminDb.collection('orders').doc(newOrderId).set({
        id: newOrderId,
        userId,
        items: validatedItems,
        totalAmount: finalOrderTotal,
        subtotal: serverCalculatedTotal,
        deliveryFee,
        taxes,
        discountAmount,
        status: 'pending_acceptance',
        notification_version: 1,
        deliveryAddress: { 
          addressLine: userAddress || 'Pickup', 
          lat: location?.lat || userData.lat || userData.location?.lat || 0, 
          lng: location?.lng || userData.lng || userData.location?.lng || 0,
          houseNumber: addressDetails?.houseNumber || '',
          apartment: addressDetails?.apartment || '',
          landmark: addressDetails?.landmark || '',
          instructions: addressDetails?.instructions || ''
        },
        contactPhone: userPhone,
        customerName: userData.name || (req.user as any)?.name || 'Gourmet Customer',
        // Canonical order identifiers
        dailyOrderNumber: dailyOrderNumber > 0 ? dailyOrderNumber : null,
        orderDateLocal,
        // Legacy field for backwards-compat with older listeners
        daily_order_number: orderNumber,
        paymentMethod: req.body.paymentMethod || 'COD',
        paymentId: req.body.paymentId || ('pay_' + newOrderId.slice(0, 8)),
        deliveryType,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      trace.steps.push({ step: 'Firestore Write', status: 'success', orderId: newOrderId, dailyOrderNumber });
    } catch (err: any) {
      console.warn('[Orders] Firestore write failed:', err);
      trace.steps.push({ step: 'Firestore Write', status: 'error', error: err.message });
      res.status(500).json({ error: 'Failed to save order' });
      return;
    }

    trace.processingTime = Date.now() - startTime;
    res.status(201).json({ 
      message: 'Order placed successfully', 
      orderId: newOrderId, 
      orderNumber, 
      dailyOrderNumber: dailyOrderNumber > 0 ? dailyOrderNumber : null, 
      orderDateLocal, 
      trace: isDebug ? trace : undefined 
    });

    // Release checkout lock immediately so customer can place next order without waiting
    query('DELETE FROM checkout_locks WHERE user_id = $1', [userId]).catch(() => {});

    // 5. Asynchronous Background Dispatch (Non-blocking: Customer receives instant response)
    setImmediate(async () => {
      try {
        const ownerUids = await notificationEngine.resolveByRole('owner');
        if (ownerUids.length > 0) {
          const ownerPayload = OwnerTemplates.newOrder(newOrderId, {
            customerName: userData.name || 'Customer',
            orderNumber,
            totalAmount: finalOrderTotal,
            items: validatedItems.map(i => i.name + ' x' + i.quantity),
            paymentMethod: req.body.paymentMethod || 'COD',
            deliveryAddress: userAddress || 'Pickup',
            phone: userPhone,
            orderTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            version: 1,
          });
          await notificationEngine.sendBulk(ownerUids, ownerPayload, { category: 'alarm_actionable', priority: 'critical', orderId: newOrderId });
        }
      } catch (notifErr: any) {
        console.error('[Orders] Async NotificationEngine dispatch error:', notifErr.message);
      }

      // Customer Confirmation Email Dispatch (Non-blocking)
      if (userData.email) {
        try {
          const { buildOrderStatusEmail } = await import('../services/emailTemplates.service.js');
          const customerEmailHtml = buildOrderStatusEmail({
            customerName: userData.name || 'Valued Customer',
            subject: 'Order Placed - Olive Pizza',
            stage: 'pending',
            orderId: newOrderId,
            data: { orderNumber, totalAmount: 'Rs. ' + finalOrderTotal },
            orderData: {
              items: validatedItems,
              total_amount: finalOrderTotal,
              subtotal: serverCalculatedTotal,
              delivery_address: { addressLine1: userAddress, fullName: userData.name, phone: userPhone },
              payment_method: req.body.paymentMethod || 'COD'
            }
          });

          await queueEmail(
            userData.email,
            'Your Olive Pizza Order ' + orderNumber + ' is Received!',
            customerEmailHtml,
            'transactional',
            null,
            'order_placed_' + newOrderId
          );
        } catch (emailErr: any) {
          console.warn('[Orders] Customer order placed email queue warning:', emailErr.message);
        }
      }

      try {
        await orderEventService.emitNewOrder(newOrderId);
      } catch (pushErr: any) {
        console.error('[Orders] Async OrderEventService failed:', pushErr.message);
      }
    });
  } catch (error: any) {
    console.error('Error creating order:', error);
    trace.steps.push({ step: 'Fatal Error', status: 'failed', error: error.message });
    trace.processingTime = Date.now() - startTime;
    res.status(500).json({ error: 'Failed to create order', trace: isDebug ? trace : undefined });
  } finally {
    if (userId) {
      try {
        await query('DELETE FROM checkout_locks WHERE user_id = $1', [userId]);
      } catch(e) {
        console.error('Failed to release checkout lock:', e);
      }
    }
  }
});

// Owner Accept Order
router.post('/:id/accept', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;
    const uid = req.user?.uid;
    if (userRole !== 'owner' || !uid) return res.status(403).json({ error: 'Unauthorized' });

    await adminDb.collection('orders').doc(id).update({
      status: 'preparing',
      updatedAt: new Date()
    });

    orderEventService.emitStatusChange(id, 'preparing', uid);
    res.json({ success: true, status: 'preparing' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to accept order' });
  }
});

// Owner Reject Order
router.post('/:id/reject', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;
    const uid = req.user?.uid;
    if (userRole !== 'owner' || !uid) return res.status(403).json({ error: 'Unauthorized' });

    await adminDb.collection('orders').doc(id).update({
      status: 'cancelled',
      cancellationReason: req.body.reason || 'Rejected by restaurant',
      updatedAt: new Date()
    });

    orderEventService.emitStatusChange(id, 'cancelled', uid);
    res.json({ success: true, status: 'cancelled' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reject order' });
  }
});

export default router;
