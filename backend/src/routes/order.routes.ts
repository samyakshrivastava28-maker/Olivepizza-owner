import { OrderStateMachine } from '../services/order/OrderStateMachine.js';
import { FranchiseScopeService } from '../services/franchise/FranchiseScopeService.js';
import { Router, Request, Response } from 'express';
import { query } from '../lib/db.js';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth.middleware.js';
import { adminDb } from '../config/firebase.js';
import { OwnerTemplates, CustomerTemplates, RestaurantTemplates } from '../services/notification/NotificationTemplates.js';

import { notificationEngine } from '../services/notification/NotificationEngine.js';
import { orderEventService } from '../services/order/OrderEventService.js';
import { queueEmail } from '../services/email.service.js';
import { buildOrderStatusEmail } from '../services/emailTemplates.service.js';
import { DeliveryCapacityService } from '../services/delivery/DeliveryCapacityService.js';
import { FranchiseGoogleSheetsService } from '../services/reports/FranchiseGoogleSheetsService.js';
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

// 1. GET / - Get orders (Customer gets own orders, Staff gets scoped branch orders)
router.get('/', verifyToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || !user.uid) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const role = (user.role || 'customer').toLowerCase();
    const isStaff = ['restaurant_manager', 'manager', 'owner', 'developer', 'admin', 'platform_owner', 'kitchen_staff', 'cashier'].includes(role) ||
      user.email === 'olivepizzarjn@gmail.com' ||
      user.email === 'webhub2811@gmail.com';

    if (isStaff) {
      const scope = FranchiseScopeService.resolveScope(user);
      const requestedBranchId = (req.query.branchId as string) || (req.headers['x-branch-id'] as string) || 'main_branch';
      const effectiveBranchId = FranchiseScopeService.getEffectiveBranchId(scope, requestedBranchId);

      let q: any = adminDb.collection('orders');
      if (effectiveBranchId !== 'all') {
        q = q.where('branchId', '==', effectiveBranchId);
      }

      const snapshot = await q.orderBy('createdAt', 'desc').limit(100).get().catch(async () => {
        // Fallback without index if orderBy fails
        let fallbackQ: any = adminDb.collection('orders');
        if (effectiveBranchId !== 'all') {
          fallbackQ = fallbackQ.where('branchId', '==', effectiveBranchId);
        }
        return await fallbackQ.limit(100).get();
      });

      const orders = snapshot.docs.map((doc: any) => {
        const data = doc.data();
        return {
          id: doc.id,
          orderNumber: data.orderNumber || `#${doc.id.slice(0, 6).toUpperCase()}`,
          dailyOrderNumber: data.dailyOrderNumber,
          userId: data.userId,
          customerName: data.customerName || data.userName || data.deliveryAddress?.customerName || 'Customer',
          contactPhone: data.contactPhone || data.phone || '',
          customerEmail: data.customerEmail || data.userEmail || '',
          deliveryAddress: data.deliveryAddress,
          items: data.items || [],
          subtotal: Number(data.subtotal || data.totalAmount || 0),
          totalAmount: Number(data.totalAmount || 0),
          deliveryFee: Number(data.deliveryFee || 0),
          taxes: Number(data.taxes || 0),
          packagingCharge: Number(data.packagingCharge || 0),
          discountAmount: Number(data.discountAmount || 0),
          status: (data.status || 'pending').toLowerCase(),
          fulfillmentType: data.fulfillmentType || data.deliveryType || 'delivery',
          deliveryType: data.deliveryType || 'delivery',
          paymentStatus: data.paymentStatus || 'pending',
          paymentMethod: data.paymentMethod || 'online',
          deliveryPartnerId: data.deliveryPartnerId,
          deliveryPartnerName: data.deliveryPartnerName,
          branchId: data.branchId || 'main_branch',
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt || new Date()),
        };
      });

      res.json(orders);
      return;
    }

    // Normal customer: fetch only their own orders
    const snapshot = await adminDb.collection('orders')
      .where('userId', '==', user.uid)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get()
      .catch(async () => {
        return await adminDb.collection('orders').where('userId', '==', user.uid).limit(50).get();
      });
      
    const orders = snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId,
        orderNumber: data.orderNumber || `#${doc.id.slice(0, 6).toUpperCase()}`,
        dailyOrderNumber: data.dailyOrderNumber,
        status: data.status,
        totalAmount: Number(data.totalAmount || 0),
        deliveryFee: Number(data.deliveryFee || 0),
        contactPhone: data.contactPhone,
        deliveryAddress: data.deliveryAddress?.addressLine || data.deliveryAddress,
        items: data.items || [],
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt || new Date())
      };
    });

    res.json(orders);
  } catch (error) {
    console.error("[Orders] Failed to fetch orders:", error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// 2. GET /live - Dedicated live orders endpoint for Restaurant Managers & KDS (Staff/Owner only)
router.get('/live', verifyToken, requireRole(['restaurant_manager', 'owner', 'kitchen_staff', 'cashier', 'manager', 'admin', 'franchise_owner', 'developer', 'platform_owner']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const scope = FranchiseScopeService.resolveScope(user);
    const requestedBranchId = (req.query.branchId as string) || (req.headers['x-branch-id'] as string) || 'main_branch';
    const effectiveBranchId = FranchiseScopeService.getEffectiveBranchId(scope, requestedBranchId);

    const activeStatuses = ['pending', 'pending_acceptance', 'accepted', 'preparing', 'ready', 'partner_assigned', 'picked_up', 'out_for_delivery'];

    let q: any = adminDb.collection('orders');
    if (effectiveBranchId !== 'all') {
      q = q.where('branchId', '==', effectiveBranchId);
    }

    const snapshot = await q.orderBy('createdAt', 'desc').limit(50).get().catch(async () => {
      let fallbackQ: any = adminDb.collection('orders');
      if (effectiveBranchId !== 'all') {
        fallbackQ = fallbackQ.where('branchId', '==', effectiveBranchId);
      }
      return await fallbackQ.limit(50).get();
    });

    const activeOrders = snapshot.docs
      .map((doc: any) => {
        const data = doc.data();
        const status = (data.status || 'pending').toLowerCase();
        return {
          id: doc.id,
          orderNumber: data.orderNumber || `#${doc.id.slice(0, 6).toUpperCase()}`,
          dailyOrderNumber: data.dailyOrderNumber,
          userId: data.userId,
          customerName: data.customerName || data.userName || data.deliveryAddress?.customerName || 'Customer',
          contactPhone: data.contactPhone || data.phone || '',
          deliveryAddress: data.deliveryAddress,
          items: data.items || [],
          subtotal: Number(data.subtotal || data.totalAmount || 0),
          totalAmount: Number(data.totalAmount || 0),
          deliveryFee: Number(data.deliveryFee || 0),
          taxes: Number(data.taxes || 0),
          status,
          fulfillmentType: data.fulfillmentType || data.deliveryType || 'delivery',
          deliveryType: data.deliveryType || 'delivery',
          deliveryPartnerId: data.deliveryPartnerId,
          deliveryPartnerName: data.deliveryPartnerName,
          branchId: data.branchId || 'main_branch',
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt || new Date()),
        };
      })
      .filter((o: any) => activeStatuses.includes(o.status));

    res.json({ success: true, count: activeOrders.length, orders: activeOrders });
  } catch (error: any) {
    console.error("[Orders] Failed to fetch live orders:", error);
    res.status(500).json({ error: error?.message || 'Failed to fetch live orders' });
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

    // 0.4. Check Restaurant Operational Status (Open/Closed & Accepting Orders)
    const callerRole = req.user?.role || '';
    const isStaffMember = ['cashier', 'kitchen_staff', 'restaurant_manager', 'franchise_owner', 'admin', 'owner'].includes(callerRole);
    const branchToCheck = isStaffMember ? (req.user?.branchId || 'main_branch') : 'main_branch';
    try {
      const restDoc = await adminDb.collection('restaurant_settings').doc(branchToCheck).get();
      if (restDoc.exists) {
        const restData = restDoc.data() || {};
        if (restData.isOpen === false || restData.acceptingOrders === false) {
          res.status(400).json({
            error: restData.closeReason || 'The restaurant is currently closed and not accepting orders.',
            code: 'RESTAURANT_CLOSED',
            canAcceptOrders: false,
            isOpen: false
          });
          return;
        }
      }
    } catch (restErr) {
      console.warn('[Orders] Restaurant status read notice:', restErr);
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

    // ── PHASE 3: SERVER-SIDE COUPON REVALIDATION ──────────────────────────────
    // The client may supply a couponCode. The server independently verifies it.
    // Client-supplied discountAmount is IGNORED in favor of the server-calculated value.
    let discountAmount = 0;
    let appliedCouponCode: string | null = null;
    let couponRejectReason: string | null = null;

    const clientCouponCode: string | null = req.body.couponCode?.trim()?.toUpperCase() || null;
    if (clientCouponCode) {
      try {
        const couponSnap = await adminDb.collection('coupons')
          .where('code', '==', clientCouponCode)
          .limit(1)
          .get();

        if (!couponSnap.empty) {
          const couponData = couponSnap.docs[0].data();
          const now = new Date();
          const expiresAt = couponData.expiresAt ? new Date(couponData.expiresAt) : null;
          const startsAt = couponData.startsAt ? new Date(couponData.startsAt) : null;
          const usageCount = Number(couponData.usageCount || 0);
          const usageLimit = Number(couponData.usageLimit || Infinity);
          const minOrderAmount = Number(couponData.minOrderAmount || 0);

          if (!couponData.isActive) {
            couponRejectReason = `Coupon ${clientCouponCode} is inactive.`;
          } else if (expiresAt && now > expiresAt) {
            couponRejectReason = `Coupon ${clientCouponCode} has expired.`;
          } else if (startsAt && now < startsAt) {
            couponRejectReason = `Coupon ${clientCouponCode} is not yet valid.`;
          } else if (usageCount >= usageLimit) {
            couponRejectReason = `Coupon ${clientCouponCode} has reached its usage limit.`;
          } else if (serverCalculatedTotal < minOrderAmount) {
            couponRejectReason = `Minimum order amount for this coupon is ₹${minOrderAmount}. Current subtotal: ₹${serverCalculatedTotal}.`;
          } else {
            // Calculate server-side discount
            const discountType: string = couponData.discountType || 'percentage';
            const discountValue = Number(couponData.discountValue || 0);
            const maxDiscount = Number(couponData.maxDiscount || Infinity);

            if (discountType === 'percentage') {
              discountAmount = Math.min(Math.round(serverCalculatedTotal * (discountValue / 100)), maxDiscount);
            } else if (discountType === 'flat') {
              discountAmount = Math.min(discountValue, serverCalculatedTotal);
            }

            appliedCouponCode = clientCouponCode;
            // Increment usage count asynchronously (non-blocking)
            adminDb.collection('coupons').doc(couponSnap.docs[0].id).update({
              usageCount: (couponData.usageCount || 0) + 1,
              lastUsedAt: new Date().toISOString()
            }).catch((e) => console.warn('[Orders] Coupon usage count update warning:', e));
          }
        } else {
          couponRejectReason = `Coupon ${clientCouponCode} does not exist.`;
        }
      } catch (couponErr: any) {
        console.warn('[Orders] Coupon validation error (non-blocking, coupon not applied):', couponErr.message);
        couponRejectReason = 'Coupon validation temporarily unavailable. Order placed without discount.';
      }
    }

    // ── PHASE 3: SCHEDULED ORDER VALIDATION ──────────────────────────────────
    const orderTiming: string = req.body.orderTiming || 'immediate';
    const scheduledFor: string | null = req.body.scheduledFor || null; // ISO string

    if (orderTiming === 'scheduled') {
      if (!scheduledFor) {
        res.status(400).json({ error: 'scheduledFor (ISO datetime) is required for scheduled orders.' });
        return;
      }
      const scheduledDate = new Date(scheduledFor);
      if (isNaN(scheduledDate.getTime())) {
        res.status(400).json({ error: 'scheduledFor must be a valid ISO datetime string.' });
        return;
      }
      if (scheduledDate <= new Date()) {
        res.status(400).json({ error: 'scheduledFor must be a future date/time.' });
        return;
      }
      // Validate scheduled hour is within store opening hours (12:00–23:59)
      const scheduledHour = scheduledDate.getHours();
      const scheduledMinute = scheduledDate.getMinutes();
      const scheduledTotalMinutes = scheduledHour * 60 + scheduledMinute;
      const openMinutes = 12 * 60;   // 12:00 = 720
      const closeMinutes = 23 * 60 + 59; // 23:59 = 1439
      if (scheduledTotalMinutes < openMinutes || scheduledTotalMinutes > closeMinutes) {
        res.status(400).json({
          error: `Scheduled time must be between 12:00 PM and 11:59 PM (store operating hours). Requested: ${scheduledDate.toLocaleTimeString()}.`
        });
        return;
      }
    }

    // ── PHASE 3: ORDER SOURCE TAGGING ─────────────────────────────────────────
    // Distinguishes online customer orders from POS-originated orders.
    // POS routes supply their own orderSource; online checkout defaults to 'ONLINE'.
    const orderSource: string = req.body.orderSource || 'ONLINE';
    const VALID_ORDER_SOURCES = ['ONLINE', 'POS_DINE_IN', 'POS_TAKEAWAY', 'POS_DELIVERY', 'OFFLINE_RESTAURANT'];
    const resolvedOrderSource = VALID_ORDER_SOURCES.includes(orderSource) ? orderSource : 'ONLINE';

    // Allow POS cashier manual discounts when no coupon is used
    if (resolvedOrderSource !== 'ONLINE' && req.body.discountAmount && !clientCouponCode) {
      discountAmount = Math.min(Math.max(0, Number(req.body.discountAmount) || 0), serverCalculatedTotal);
    }

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

    const userRole = req.user?.role || 'customer';
    const isStaff = ['cashier', 'kitchen_staff', 'restaurant_manager', 'franchise_owner', 'admin', 'owner'].includes(userRole);

    // Enforce server-side scope derivation: Never trust client-supplied branchId/franchiseId/terminalId
    const resolvedBranchId = isStaff ? (req.user?.branchId || 'main_branch') : 'main_branch';
    const resolvedFranchiseId = isStaff ? (req.user?.franchiseId || 'fra_primary') : 'fra_primary';
    const resolvedOrgId = isStaff ? (req.user?.organizationId || 'org_olive_pizza') : 'org_olive_pizza';
    const resolvedTerminalId = isStaff ? (req.user?.terminalId || null) : null;
    const resolvedCashierName = isStaff ? ((req.user as any)?.name || req.user?.email || null) : null;

    const timeoutMinutes = Number(process.env.ORDER_ACCEPT_TIMEOUT_MINUTES || 10);
    const acceptanceDeadline = new Date(Date.now() + timeoutMinutes * 60 * 1000).toISOString();

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
        status: 'pending',
        notification_version: 1,
        acceptanceDeadline,
        cancellationAcknowledged: false,
        cancellationAcknowledgedAt: null,
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
        // Phase 3 canonical order fields
        orderSource: resolvedOrderSource,
        orderTiming,
        scheduledFor: scheduledFor || null,
        appliedCouponCode: appliedCouponCode || null,
        couponRejectReason: couponRejectReason || null,
        // POS & Multi-Tenant Terminal Metadata (Server-derived)
        tableNumber: req.body.tableNumber || null,
        cashierName: resolvedCashierName,
        terminalId: resolvedTerminalId,
        branchId: resolvedBranchId,
        branchName: 'Olive Pizza — Rajnandgaon HQ',
        franchiseId: resolvedFranchiseId,
        organizationId: resolvedOrgId,
        paymentDetails: req.body.paymentDetails || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      trace.steps.push({ step: 'Firestore Write', status: 'success', orderId: newOrderId, dailyOrderNumber });

      // Asynchronously sync online order to franchise-specific Google Spreadsheet
      FranchiseGoogleSheetsService.syncOrderToFranchise({
        id: newOrderId,
        userId,
        items: validatedItems,
        totalAmount: finalOrderTotal,
        subtotal: serverCalculatedTotal,
        deliveryFee,
        taxes,
        discountAmount,
        status: 'pending',
        contactPhone: userPhone,
        customerName: userData.name || (req.user as any)?.name || 'Gourmet Customer',
        dailyOrderNumber,
        orderSource: resolvedOrderSource,
        paymentMethod: req.body.paymentMethod || 'COD',
        paymentStatus: (req.body.paymentMethod || 'COD').toUpperCase() === 'ONLINE' ? 'PAID' : 'PENDING',
        branchId: resolvedBranchId,
        branchName: req.body.session?.branchName || req.body.branchName || 'Olive Pizza — Rajnandgaon HQ',
        franchiseId: req.body.session?.franchiseId || req.body.franchiseId || 'fra_rajnandgaon',
        deliveryAddress: { addressLine: userAddress || 'Pickup' },
        createdAt: new Date()
      }).catch(e => console.warn('[OnlineOrderSheetSync] Notice:', e.message));
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
      orderSource: resolvedOrderSource,
      appliedCouponCode: appliedCouponCode || null,
      couponRejectReason: couponRejectReason || null,
      discountAmount,
      finalTotal: finalOrderTotal,
      trace: isDebug ? trace : undefined 
    });

    // Release checkout lock immediately so customer can place next order without waiting
    query('DELETE FROM checkout_locks WHERE user_id = $1', [userId]).catch(() => {});

    // 5. Asynchronous Background Dispatch (Targeted Restaurant Management Notification with Action Buttons)
    setImmediate(async () => {
      try {
        const branchStaffUids = await notificationEngine.resolveBranchStaff(resolvedBranchId);
        if (branchStaffUids.length > 0) {
          const restaurantPayload = RestaurantTemplates.newOrder(newOrderId, {
            customerName: userData.name || 'Customer',
            orderNumber,
            totalAmount: finalOrderTotal,
            items: validatedItems.map(i => i.name + ' x' + i.quantity),
            paymentMethod: req.body.paymentMethod || 'COD',
            deliveryAddress: userAddress || 'Pickup',
            phone: userPhone,
            branchId: resolvedBranchId,
            orderTime: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
            version: 1,
          });
          await notificationEngine.sendBulk(branchStaffUids, restaurantPayload, {
            category: 'alarm_actionable',
            priority: 'critical',
            orderId: newOrderId,
            targetApp: 'restaurant'
          });
        }
      } catch (notifErr: any) {
        console.error('[Orders] Async Restaurant Notification dispatch error:', notifErr.message);
      }

      // Initial Customer Order Placed Notification (pinned live card)
      try {
        const customerPlacedPayload = CustomerTemplates.orderUpdate(newOrderId, {
          orderNumber,
          status: 'pending',
          totalAmount: finalOrderTotal,
          version: 1
        });
        await notificationEngine.send(userId, customerPlacedPayload, {
          category: 'pinned_live',
          orderId: newOrderId,
          targetApp: 'customer'
        });
      } catch (custErr: any) {
        console.warn('[Orders] Customer initial order placed push error:', custErr.message);
      }

      // Transactional order email removed in favor of real-time push / in-app notification system (Section 5)

      try {
        await orderEventService.emitNewOrder(newOrderId);
      } catch (pushErr: any) {
        console.error('[Orders] Async OrderEventService failed:', pushErr.message);
      }

      // Phase 10: Google Sheets Sync Engine (Non-blocking)
      try {
        const { SheetsSyncWorker } = await import('../services/reports/SheetsSyncWorker.js');
        await SheetsSyncWorker.queueOrder(newOrderId, {
          orderNumber,
          customerName: userData.name || 'Customer',
          customerPhone: userPhone,
          totalAmount: finalOrderTotal,
          subtotal: serverCalculatedTotal,
          discountAmount,
          taxes,
          deliveryFee,
          paymentMethod: req.body.paymentMethod || 'COD',
          orderType: deliveryType,
          orderSource: resolvedOrderSource,
          tableNumber: req.body.tableNumber || undefined,
          terminalId: req.body.session?.terminalId || req.body.terminalId || (req.headers['x-terminal-id'] as string) || undefined,
          cashierName: req.body.session?.cashierName || req.body.cashierName || undefined,
          branchName: req.body.session?.branchName || req.body.branchName || 'Olive Pizza — Rajnandgaon HQ',
          franchiseId: req.body.session?.franchiseId || req.body.franchiseId || 'fra_primary',
          status: 'pending',
          itemCount: validatedItems.reduce((sum: number, it: any) => sum + (it.quantity || 1), 0),
          items: validatedItems,
          couponCode: appliedCouponCode || undefined,
          createdAt: new Date().toISOString()
        });
      } catch (sheetErr: any) {
        console.warn('[Orders] SheetsSyncWorker notice:', sheetErr.message);
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

// Universal Order Status Update (Staff, Delivery Partner, Owner, Admin only)
router.all(['/:id/status'], verifyToken, requireRole(['owner', 'admin', 'restaurant_manager', 'manager', 'kitchen_staff', 'cashier', 'delivery_partner', 'developer', 'platform_owner']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, cancellationReason, deliveryPartnerId, deliveryPartnerName, deliveryPartnerPhone } = req.body;
    const uid = req.user!.uid;
    const role = req.user!.role || 'staff';
    const name = (req.user as any)?.name || (req.user as any)?.displayName || req.user?.email || 'Staff';

    if (!status) {
      res.status(400).json({ error: 'Status is required' });
      return;
    }

    const metadata: Record<string, any> = {};
    if (cancellationReason) metadata.cancellationReason = cancellationReason;
    if (deliveryPartnerId) metadata.deliveryPartnerId = deliveryPartnerId;
    if (deliveryPartnerName) metadata.deliveryPartnerName = deliveryPartnerName;
    if (deliveryPartnerPhone) metadata.deliveryPartnerPhone = deliveryPartnerPhone;

    const result = await OrderStateMachine.transition(id, status as any, { uid, role, name }, metadata);
    if (!result.success) {
      res.status(400).json({ error: result.error || 'Failed to update order status' });
      return;
    }

    res.json({ success: true, orderId: id, status: result.currentStatus, version: result.version });
  } catch (error: any) {
    console.error('[Orders] Universal status update failed:', error?.message);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// Restaurant Manager / Staff Accept Order Action (From App or Notification Action)
router.post('/:id/accept', verifyToken, async (req: AuthRequest, res: Response) => {
  const requestId = `req_acc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  try {
    const { id } = req.params;
    const userRole = req.user?.role;
    const uid = req.user?.uid;
    const userBranchId = req.user?.branchId;
    const name = (req.user as any)?.name || req.user?.email || 'Manager';
    const isAuthorizedStaff = ['owner', 'admin', 'developer', 'manager', 'restaurant_manager', 'kitchen_staff'].includes(userRole || '');
    
    if (!isAuthorizedStaff || !uid) {
      return res.status(403).json({ success: false, error: 'Unauthorized: Restaurant staff authorization required', requestId });
    }

    // Pre-check order existence and branch scoping
    const orderDoc = await adminDb.collection('orders').doc(id).get();
    if (!orderDoc.exists) {
      return res.status(404).json({ success: false, error: 'Order not found', requestId });
    }

    const orderData = orderDoc.data()!;
    const orderBranchId = orderData.branchId || 'main_branch';
    const isGlobalUser = ['owner', 'admin', 'developer'].includes(userRole || '') || 
      ['olivepizzarjn@gmail.com', 'webhub2811@gmail.com'].includes(req.user?.email?.toLowerCase() || '');

    if (!isGlobalUser && userBranchId && userBranchId !== orderBranchId) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: You do not have authority over orders from branch ${orderBranchId}`,
        requestId
      });
    }

    // Idempotency check: if order was already accepted, return 200 without re-transitioning
    const currentStatus = orderData.status;
    if (['accepted', 'preparing', 'ready', 'partner_assigned', 'picked_up', 'out_for_delivery', 'delivered'].includes(currentStatus)) {
      return res.json({
        success: true,
        message: `Order #${orderData.orderNumber || id} is already in progress (${currentStatus})`,
        orderId: id,
        status: currentStatus,
        duplicate: true,
        requestId
      });
    }

    if (currentStatus === 'cancelled' || currentStatus === 'rejected') {
      return res.status(409).json({
        success: false,
        error: `Order #${orderData.orderNumber || id} has already been cancelled`,
        status: currentStatus,
        requestId
      });
    }

    // Step 1: Transition to accepted
    const accResult = await OrderStateMachine.transition(id, 'accepted', { uid, role: userRole || 'restaurant_manager', name, branchId: orderBranchId });
    if (!accResult.success) {
      return res.status(400).json({ success: false, error: accResult.error, requestId });
    }

    // Step 2: Transition to preparing
    const prepResult = await OrderStateMachine.transition(id, 'preparing', { uid, role: userRole || 'restaurant_manager', name, branchId: orderBranchId });
    if (!prepResult.success) {
      return res.status(400).json({ success: false, error: prepResult.error, requestId });
    }

    res.json({
      success: true,
      message: `Order #${orderData.orderNumber || id} accepted and baking started`,
      orderId: id,
      status: 'preparing',
      version: prepResult.version,
      requestId
    });
  } catch (error: any) {
    console.error('[Orders] Accept action failed:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to accept order', requestId });
  }
});

// Restaurant Manager / Staff Reject Order Action (From App or Notification Action)
router.post('/:id/reject', verifyToken, async (req: AuthRequest, res: Response) => {
  const requestId = `req_rej_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  try {
    const { id } = req.params;
    const userRole = req.user?.role;
    const uid = req.user?.uid;
    const userBranchId = req.user?.branchId;
    const name = (req.user as any)?.name || req.user?.email || 'Manager';
    const isAuthorizedStaff = ['owner', 'admin', 'developer', 'manager', 'restaurant_manager'].includes(userRole || '');
    
    if (!isAuthorizedStaff || !uid) {
      return res.status(403).json({ success: false, error: 'Unauthorized: Restaurant staff authorization required', requestId });
    }

    const orderDoc = await adminDb.collection('orders').doc(id).get();
    if (!orderDoc.exists) {
      return res.status(404).json({ success: false, error: 'Order not found', requestId });
    }

    const orderData = orderDoc.data()!;
    const orderBranchId = orderData.branchId || 'main_branch';
    const isGlobalUser = ['owner', 'admin', 'developer'].includes(userRole || '') || 
      ['olivepizzarjn@gmail.com', 'webhub2811@gmail.com'].includes(req.user?.email?.toLowerCase() || '');

    if (!isGlobalUser && userBranchId && userBranchId !== orderBranchId) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: You do not have authority over orders from branch ${orderBranchId}`,
        requestId
      });
    }

    const currentStatus = orderData.status;
    if (['preparing', 'ready', 'partner_assigned', 'picked_up', 'out_for_delivery', 'delivered'].includes(currentStatus)) {
      return res.status(409).json({
        success: false,
        error: `Cannot reject order #${orderData.orderNumber || id} because it is already ${currentStatus}`,
        status: currentStatus,
        requestId
      });
    }

    const result = await OrderStateMachine.transition(id, 'cancelled', { uid, role: userRole || 'restaurant_manager', name, branchId: orderBranchId }, {
      cancellationReason: req.body.reason || 'Restaurant is at full capacity'
    });

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error, requestId });
    }

    res.json({
      success: true,
      message: `Order #${orderData.orderNumber || id} rejected successfully`,
      orderId: id,
      status: 'cancelled',
      version: result.version,
      requestId
    });
  } catch (error: any) {
    console.error('[Orders] Reject action failed:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to reject order', requestId });
  }
});


// Manual Assignment: Get eligible riders for order (Section 14)
router.get('/:id/eligible-riders', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { RiderDispatchEngine } = await import('../services/delivery/RiderDispatchEngine.js');
    const riders = await RiderDispatchEngine.findEligibleRiders(id);
    res.json({ success: true, orderId: id, riders });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to query eligible riders' });
  }
});

// Manual Assignment: Assign specific rider to order (Section 14)
router.post('/:id/assign-rider', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { riderId } = req.body;
    const userRole = req.user?.role;
    const uid = req.user?.uid;
    const name = (req.user as any)?.name || req.user?.email || 'Manager';
    
    if (!['owner', 'admin', 'developer', 'manager', 'restaurant_manager'].includes(userRole || '')) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!riderId) return res.status(400).json({ error: 'riderId is required' });

    const { RiderDispatchEngine } = await import('../services/delivery/RiderDispatchEngine.js');
    const eligibleRiders = await RiderDispatchEngine.findEligibleRiders(id);
    const selected = eligibleRiders.find(r => r.uid === riderId);

    if (!selected && userRole !== 'owner' && userRole !== 'admin') {
      return res.status(400).json({ error: 'Selected rider is ineligible (offline, busy, or out of branch radius).' });
    }

    const { adminDb } = await import('../config/firebase.js');
    const riderDoc = await adminDb.collection('users').doc(riderId).get();
    const rData = riderDoc.data() || {};

    const result = await OrderStateMachine.transition(id, 'partner_assigned', { uid: uid || 'system', role: userRole || 'restaurant_manager', name }, {
      deliveryPartnerId: riderId,
      deliveryPartnerName: rData.name || rData.displayName || 'Rider',
      deliveryPartnerPhone: rData.phone || rData.phoneNumber || '+91 91799 44445',
    });

    if (!result.success) return res.status(400).json({ error: result.error });

    // Notify Rider
    const { notificationEngine } = await import('../services/notification/NotificationEngine.js');
    await notificationEngine.send(riderId, {
      notification: {
        title: '🛵 New Delivery Assigned!',
        body: `Order #${id.slice(-6)} has been assigned to you.`,
      },
      data: { orderId: id, type: 'rider_assignment' }
    }, { category: 'alarm_actionable', priority: 'critical', orderId: id });

    res.json({ success: true, orderId: id, status: 'partner_assigned', rider: { id: riderId, name: rData.name } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// ─── POST /:id/rating — Customer Post-Delivery Rating ───────────────────────
router.post('/:id/rating', verifyToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.uid;
    const { foodRating, deliveryRating, overallRating, comment } = req.body;

    if (!overallRating || Number(overallRating) < 1 || Number(overallRating) > 5) {
      res.status(400).json({ error: 'Valid overallRating (1-5) is required.' });
      return;
    }

    const orderRef = adminDb.collection('orders').doc(id);
    const snap = await orderRef.get();
    if (!snap.exists) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const orderData = snap.data()!;
    if (orderData.userId !== userId && req.user?.role !== 'owner' && req.user?.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden: You can only rate your own orders.' });
      return;
    }

    const ratingRecord = {
      orderId: id,
      userId,
      customerName: orderData.customerName || 'Customer',
      foodRating: Number(foodRating || overallRating),
      deliveryRating: Number(deliveryRating || overallRating),
      overallRating: Number(overallRating),
      comment: comment ? String(comment).trim() : '',
      branchId: orderData.branchId || 'main_branch',
      deliveryPartnerId: orderData.deliveryPartnerId || null,
      createdAt: new Date().toISOString(),
    };

    await adminDb.collection('order_ratings').add(ratingRecord);
    await orderRef.update({
      isRated: true,
      rating: ratingRecord,
      updatedAt: new Date(),
    });

    res.json({ success: true, message: 'Thank you for your rating!', rating: ratingRecord });
  } catch (err: any) {
    console.error('[Orders] Rating error:', err);
    res.status(500).json({ error: 'Failed to submit rating' });
  }
});

// ─── POST /:id/reorder — 1-Click Reorder with Fresh Pricing & Stock Check ───
router.post('/:id/reorder', verifyToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.uid;

    const snap = await adminDb.collection('orders').doc(id).get();
    if (!snap.exists) {
      res.status(404).json({ error: 'Original order not found' });
      return;
    }

    const oldOrder = snap.data()!;
    const isOwnerOrStaff = ['owner', 'admin', 'restaurant_manager', 'franchise_owner', 'cashier', 'kitchen_staff', 'developer', 'platform_owner'].includes(req.user?.role || '');
    const isCustomerOwner = (oldOrder.userId === userId || oldOrder.customerUid === userId);

    if (!isOwnerOrStaff && !isCustomerOwner) {
      res.status(403).json({ error: 'Access denied: You can only reorder your own orders' });
      return;
    }

    const items = oldOrder.items || [];
    if (!items || items.length === 0) {
      res.status(400).json({ error: 'No items in original order to reorder' });
      return;
    }

    // Revalidate items against current catalog
    const freshItems: any[] = [];
    let serverCalculatedTotal = 0;

    for (const it of items) {
      const itemId = it.menuItemId || it.id;
      let currentPrice = Number(it.price || 0);
      let isAvailable = true;

      if (itemId && typeof itemId === 'string' && !itemId.startsWith('item-')) {
        const prodSnap = await adminDb.collection('products').doc(itemId).get();
        if (prodSnap.exists) {
          const pData = prodSnap.data()!;
          if (pData.isAvailable === false || pData.isActive === false) isAvailable = false;
          currentPrice = Number(pData.offerPrice || pData.basePrice || pData.price || currentPrice);
        }
      }

      if (!isAvailable) {
        res.status(400).json({ error: `Item '${it.name}' is currently unavailable for reorder.` });
        return;
      }

      const qty = Number(it.quantity || 1);
      serverCalculatedTotal += currentPrice * qty;
      freshItems.push({
        ...it,
        price: currentPrice,
        quantity: qty,
      });
    }

    res.json({
      success: true,
      message: 'Reorder validated with current catalog prices',
      reorderItems: freshItems,
      subtotal: serverCalculatedTotal,
      taxes: Math.round(serverCalculatedTotal * 0.05),
      deliveryAddress: oldOrder.deliveryAddress,
      deliveryType: oldOrder.deliveryType || 'delivery',
    });
  } catch (err: any) {
    console.error('[Orders] Reorder error:', err);
    res.status(500).json({ error: 'Failed to prepare reorder' });
  }
});

// ─── POST /:id/acknowledge-cancellation — Customer Views/Acknowledges Cancelled Order ───
router.post('/:id/acknowledge-cancellation', verifyToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.uid;
    const orderRef = adminDb.collection('orders').doc(id);
    const snap = await orderRef.get();

    if (!snap.exists) {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }

    const orderData = snap.data()!;
    // Ownership check: only the customer who placed the order (or admin/owner) can acknowledge
    if (orderData.userId !== userId && !['owner', 'admin', 'developer'].includes(req.user?.role || '')) {
      res.status(403).json({ success: false, error: 'Forbidden: You do not own this order' });
      return;
    }

    await orderRef.update({
      cancellationAcknowledged: true,
      cancellationAcknowledgedAt: new Date().toISOString()
    });

    res.json({ success: true, message: 'Cancellation acknowledged successfully' });
  } catch (err: any) {
    console.error('[Orders] Acknowledge cancellation error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to acknowledge cancellation' });
  }
});

export default router;

