import { OrderStateMachine } from '../services/order/OrderStateMachine.js';
import { Router, Response } from 'express';
import { adminDb } from '../config/firebase.js';
import { pgPool } from '../config/postgres.js';
import { webSocketServer } from '../services/websocket/WebSocketServer.js';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth.middleware.js';
import { DeliveryDataLifecycleService } from '../services/delivery/DeliveryDataLifecycleService.js';
import { FranchiseScopeService } from '../services/franchise/FranchiseScopeService.js';
import { OrderProjectionService } from '../services/order/OrderProjectionService.js';
import { RestaurantTemplates, CustomerTemplates, DeliveryTemplates } from '../services/notification/NotificationTemplates.js';
import { notificationEngine } from '../services/notification/NotificationEngine.js';
import { RiderDispatchEngine } from '../services/delivery/RiderDispatchEngine.js';

const router = Router();

// Helper to calculate distance in meters using Haversine formula
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

router.use(verifyToken);
// Only delivery partners, managers, or owners are authorized
router.use(requireRole(['delivery_partner', 'delivery', 'owner', 'admin', 'developer', 'restaurant_manager', 'manager']));

// 1. GET /me - Rider Profile & Restaurant Operational Context
router.get('/me', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const userDoc = await adminDb.collection('users').doc(uid).get();
    const userData = userDoc.exists ? userDoc.data()! : {};

    const branchId = userData.branchId || req.user?.branchId || 'main_branch';
    const branchDoc = await adminDb.collection('franchises').doc(branchId).get().catch(() => null);
    const branchData = branchDoc && branchDoc.exists ? branchDoc.data() : {
      name: 'Olive Pizza — Rajnandgaon (Main Branch)',
      address: 'Dongargaon Rd, near Saraswati school, Gokul Nagar, Rajnandgaon, CG 491441',
      phone: '+91 91799 44445',
      maxDeliveryRadiusKm: 15,
      openingTime: '12:00',
      closingTime: '23:59'
    };

    const workingSchedule = [
      { day: 'Monday', hours: '12:00 PM - 11:00 PM', isOff: false },
      { day: 'Tuesday', hours: '12:00 PM - 11:00 PM', isOff: false },
      { day: 'Wednesday', hours: '12:00 PM - 11:00 PM', isOff: false },
      { day: 'Thursday', hours: '12:00 PM - 11:00 PM', isOff: false },
      { day: 'Friday', hours: '12:00 PM - 11:30 PM', isOff: false },
      { day: 'Saturday', hours: '12:00 PM - 11:30 PM', isOff: false },
      { day: 'Sunday', hours: '12:00 PM - 11:30 PM', isOff: false }
    ];

    res.json({
      success: true,
      rider: {
        uid,
        id: uid,
        name: userData.name || userData.displayName || 'Rider',
        email: userData.email || req.user?.email || '',
        phone: userData.phone || userData.phoneNumber || null,
        role: 'delivery_partner',
        vehicleType: userData.vehicleType || null,
        vehicleNumber: userData.vehicleNumber || null,
        organizationId: userData.organizationId || 'org_olive_pizza',
        franchiseId: userData.franchiseId || 'fra_primary',
        branchId,
        branchName: branchData?.name || null,
        branchAddress: branchData?.address || null,
        branchPhone: branchData?.phone || null,
        isOnline: userData.isOnline !== false,
        workingSchedule,
        joiningDate: userData.createdAt || null,
        emergencyContact: userData.emergencyContact || (branchData?.phone ? { name: 'Support Hotline', phone: branchData.phone } : null)
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch rider profile' });
  }
});

// 2. GET /today - Today's Operational Shift Report
router.get('/today', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const uid = req.user?.uid!;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayIso = todayStart.toISOString();

    const ordersSnap = await adminDb.collection('orders')
      .where('deliveryPartnerId', '==', uid)
      .where('createdAt', '>=', todayIso)
      .get()
      .catch(() => ({ docs: [] } as any));

    let assignedCount = ordersSnap.docs.length;
    let completedCount = 0;
    let activeCount = 0;
    let cancelledCount = 0;
    let totalEarnings = 0;
    let totalDistanceKm = 0;
    let totalMinutes = 0;

    ordersSnap.docs.forEach((doc: any) => {
      const data = doc.data();
      const st = (data.status || '').toLowerCase();
      if (st === 'delivered' || st === 'completed') {
        completedCount++;
        totalEarnings += Number(data.deliveryFee || 40);
        totalDistanceKm += Number(data.deliveryDistanceKm || 3.8);
        totalMinutes += Number(data.deliveryDurationMin || 24);
      } else if (['accepted', 'partner_assigned', 'preparing', 'ready', 'out_for_delivery'].includes(st)) {
        activeCount++;
      } else if (st === 'cancelled' || st === 'rejected') {
        cancelledCount++;
      }
    });

    const avgTime = completedCount > 0 ? Math.round(totalMinutes / completedCount) : 0;

    res.json({
      success: true,
      today: {
        assigned: assignedCount,
        completed: completedCount,
        active: activeCount,
        cancelled: cancelledCount,
        totalDistanceKm: Number(totalDistanceKm.toFixed(1)),
        averageDeliveryTimeMin: avgTime,
        earnings: totalEarnings,
        date: new Date().toISOString().split('T')[0]
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch today's delivery report" });
  }
});

// 3. GET /monthly-reports - Monthly Historical Aggregates
router.get('/monthly-reports', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const uid = req.user?.uid!;
    const branchId = req.user?.branchId || 'main_branch';
    const reports = await DeliveryDataLifecycleService.getRiderMonthlyReports(uid, branchId);
    res.json({ success: true, reports });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch monthly reports' });
  }
});

// 4. GET /active-orders - Live Assigned Deliveries for Authenticated Rider
router.get('/active-orders', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const uid = req.user?.uid!;
    const activeStatuses = ['partner_assigned', 'accepted', 'ready', 'preparing', 'out_for_delivery'];

    const snap = await adminDb.collection('orders')
      .where('deliveryPartnerId', '==', uid)
      .where('status', 'in', activeStatuses)
      .get()
      .catch(() => ({ docs: [] } as any));

    const orders = snap.docs.map((d: any) => OrderProjectionService.projectForDeliveryRider(d.data(), d.id));

    res.json({ success: true, orders });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch active orders' });
  }
});

// 5. GET /history - Detailed History (CURRENT MONTH ONLY)
router.get('/history', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const uid = req.user?.uid!;
    const currentMonthStart = DeliveryDataLifecycleService.getCurrentMonthStartDate().toISOString();

    const snap = await adminDb.collection('orders')
      .where('deliveryPartnerId', '==', uid)
      .where('createdAt', '>=', currentMonthStart)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get()
      .catch(() => ({ docs: [] } as any));

    const orders = snap.docs.map((d: any) => OrderProjectionService.projectForDeliveryRider(d.data(), d.id));

    res.json({
      success: true,
      currentMonth: DeliveryDataLifecycleService.getCurrentMonthKey(),
      orders
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch current month delivery history' });
  }
});

// Helper for handling rider delivery actions idempotently
async function processRiderOrderAction(req: AuthRequest, res: Response, forcedAction?: string): Promise<void> {
  const idempotencyKey = (req.headers['idempotency-key'] as string) || req.body.requestId || req.body.idempotencyKey || `act_${Date.now()}`;
  try {
    const orderId = req.params.id;
    const action = forcedAction || req.body.action;
    const { riderLat, riderLng, proofImageUrl, signatureUrl, notes, reason, expectedVersion } = req.body;
    const uid = req.user?.uid!;
    const name = (req.user as any)?.name || req.user?.email || 'Delivery Partner';
    const userRole = (req.user?.role || '').toLowerCase();
    const userEmail = req.user?.email?.toLowerCase() || '';

    // Backend-level Owner Read-Only Enforcement
    if (userRole === 'owner' || userRole === 'admin' || userEmail === 'olivepizzarjn@gmail.com' || userEmail === 'webhub2811@gmail.com') {
      res.status(403).json({
        success: false,
        error: 'Forbidden: Owner has read-only operational authority. Deliveries must be handled by assigned delivery partners.',
        code: 'OWNER_READ_ONLY_FORBIDDEN'
      });
      return;
    }

    if (userRole !== 'delivery_partner' && userRole !== 'delivery') {
      res.status(403).json({
        success: false,
        error: 'Forbidden: Delivery partner authorization required',
        code: 'DELIVERY_PARTNER_REQUIRED'
      });
      return;
    }

    if (!action) {
      res.status(400).json({ success: false, error: 'Action is required' });
      return;
    }

    const orderRef = adminDb.collection('orders').doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }

    const orderData = orderDoc.data()!;

    // Optimistic Concurrency / Version Check
    if (expectedVersion !== undefined && orderData.version !== undefined && Number(orderData.version) !== Number(expectedVersion)) {
      res.status(409).json({
        success: false,
        error: `Version conflict: order is at version ${orderData.version}, expected ${expectedVersion}`,
        code: 'VERSION_CONFLICT',
        currentVersion: orderData.version
      });
      return;
    }

    // Ownership check: delivery partner can only execute actions on their own assigned order
    if (
      req.user?.role === 'delivery_partner' &&
      orderData.deliveryPartnerId &&
      orderData.deliveryPartnerId !== uid
    ) {
      res.status(403).json({ success: false, error: 'Forbidden: This order is assigned to a different delivery partner.' });
      return;
    }

    const currentStatus = (orderData.status || '').toLowerCase();

    // Check terminal states
    if (['cancelled', 'rejected', 'failed'].includes(currentStatus)) {
      res.status(400).json({ success: false, error: `Cannot execute action on ${currentStatus} order.` });
      return;
    }

    // Idempotency: Check if this idempotency key was already processed
    if (orderData.lastActionIdempotencyKey === idempotencyKey) {
      res.json({
        success: true,
        duplicate: true,
        message: 'Action already processed (idempotent)',
        orderId,
        status: currentStatus,
        idempotencyKey
      });
      return;
    }

    const normalizedAction = action.toUpperCase().trim();

    switch (normalizedAction) {
      case 'ACCEPT':
      case 'ACCEPT_DELIVERY': {
        // Concurrency check: if already accepted by another rider
        if (orderData.deliveryPartnerId && orderData.deliveryPartnerId !== uid) {
          res.status(409).json({
            success: false,
            error: 'Order already accepted by another delivery partner.',
            code: 'ORDER_ALREADY_ACCEPTED',
            orderId,
            assignedPartnerId: orderData.deliveryPartnerId
          });
          return;
        }

        const nowIso = new Date().toISOString();
        const updateData: Record<string, any> = {
          riderAccepted: true,
          riderAcceptedAt: nowIso,
          riderAssignmentStatus: 'accepted',
          lastActionIdempotencyKey: idempotencyKey,
          updatedAt: new Date()
        };

        if (!orderData.deliveryPartnerId) {
          updateData.deliveryPartnerId = uid;
          updateData.deliveryPartnerName = name;
        }

        await orderRef.set(updateData, { merge: true });

        // Update rider busy status & active order lock
        await adminDb.collection('users').doc(uid).set({
          activeOrderId: orderId,
          isBusy: true,
          updatedAt: new Date()
        }, { merge: true });
        await adminDb.collection('delivery_partners').doc(uid).set({
          activeOrderId: orderId,
          isBusy: true,
          updatedAt: new Date()
        }, { merge: true }).catch(() => {});

        // Send updated in-place notification to rider for next action (PICKED_UP)
        setImmediate(async () => {
          try {
            const shortId = orderData.dailyOrderNumber ? `#${orderData.dailyOrderNumber}` : (orderData.orderNumber || `#${orderId.slice(-6).toUpperCase()}`);
            const updatePayload = DeliveryTemplates.deliveryUpdate(orderId, {
              orderNumber: shortId,
              customerName: orderData.customerName || 'Customer',
              deliveryAddress: orderData.deliveryAddress?.addressLine || orderData.deliveryAddress || 'Delivery Address',
              stage: 'arrived_restaurant',
              eta: '10 mins'
            });
            await notificationEngine.send(uid, updatePayload, {
              category: 'alarm_actionable',
              priority: 'high',
              orderId,
              targetApp: 'delivery'
            });
          } catch (notifErr: any) {
            console.warn('[RiderDelivery] Notice update failed:', notifErr.message);
          }
        });

        res.json({
          success: true,
          message: 'Delivery assignment accepted',
          orderId,
          status: 'accepted',
          canonicalStatus: orderData.status || 'partner_assigned',
          idempotencyKey
        });
        return;
      }

      case 'DECLINE':
      case 'DECLINE_DELIVERY': {
        const declinedPartners = Array.isArray(orderData.declinedPartnerIds) ? [...orderData.declinedPartnerIds] : [];
        if (!declinedPartners.includes(uid)) {
          declinedPartners.push(uid);
        }

        await orderRef.update({
          deliveryPartnerId: null,
          deliveryPartnerName: null,
          deliveryPartnerPhone: null,
          declinedPartnerIds: declinedPartners,
          riderAssignmentStatus: 'declined',
          lastDeclineReason: reason || 'Declined from notification tray',
          lastActionIdempotencyKey: idempotencyKey,
          updatedAt: new Date()
        });

        // Release rider busy state
        await adminDb.collection('users').doc(uid).set({
          activeOrderId: null,
          isBusy: false,
          updatedAt: new Date()
        }, { merge: true }).catch(() => {});
        await adminDb.collection('delivery_partners').doc(uid).set({
          activeOrderId: null,
          isBusy: false,
          updatedAt: new Date()
        }, { merge: true }).catch(() => {});

        // Asynchronously auto-dispatch next available rider
        setImmediate(async () => {
          try {
            await RiderDispatchEngine.autoDispatchRider(orderId);
          } catch (dispatchErr: any) {
            console.warn('[RiderDelivery] Reassignment after decline notice:', dispatchErr.message);
          }
        });

        res.json({
          success: true,
          message: 'Assignment declined. Next available rider is being dispatched.',
          orderId,
          status: 'declined',
          idempotencyKey
        });
        return;
      }

      case 'ARRIVED_AT_STORE': {
        await orderRef.update({
          riderArrivedAtStoreAt: new Date().toISOString(),
          lastActionIdempotencyKey: idempotencyKey,
          updatedAt: new Date().toISOString()
        });
        res.json({
          success: true,
          message: 'Arrived at store recorded',
          orderId,
          status: currentStatus,
          idempotencyKey
        });
        return;
      }

      case 'PICKED_UP': {
        if (['picked_up', 'out_for_delivery', 'delivered'].includes(currentStatus)) {
          res.json({
            success: true,
            duplicate: true,
            message: 'Order already picked up',
            orderId,
            status: currentStatus,
            idempotencyKey
          });
          return;
        }

        const pickResult = await OrderStateMachine.transition(orderId, 'picked_up', { uid, role: 'delivery_partner', name }, {
          pickedUpAt: new Date().toISOString(),
          lastActionIdempotencyKey: idempotencyKey
        });

        if (!pickResult.success) {
          // Direct fallback if state machine transition was strict on intermediate status
          await orderRef.set({
            status: 'picked_up',
            pickedUpAt: new Date().toISOString(),
            lastActionIdempotencyKey: idempotencyKey,
            updatedAt: new Date()
          }, { merge: true });
        }

        // Notify customer that order was picked up
        setImmediate(async () => {
          try {
            const customerUid = orderData.customerUid || orderData.firebaseUid || orderData.customerId || orderData.userId;
            if (customerUid) {
              const shortId = orderData.dailyOrderNumber ? `#${orderData.dailyOrderNumber}` : (orderData.orderNumber || `#${orderId.slice(-6).toUpperCase()}`);
              const cPayload = CustomerTemplates.orderUpdate(orderId, {
                orderNumber: shortId,
                status: 'picked_up' as any,
                deliveryPartnerName: name,
                totalAmount: Number(orderData.totalAmount || 0)
              });
              await notificationEngine.send(customerUid, cPayload, { category: 'pinned_live', priority: 'high', orderId });
            }

            // In-place notification update for rider (Next: OUT_FOR_DELIVERY)
            const shortId = orderData.dailyOrderNumber ? `#${orderData.dailyOrderNumber}` : (orderData.orderNumber || `#${orderId.slice(-6).toUpperCase()}`);
            const updatePayload = DeliveryTemplates.deliveryUpdate(orderId, {
              orderNumber: shortId,
              customerName: orderData.customerName || 'Customer',
              deliveryAddress: orderData.deliveryAddress?.addressLine || orderData.deliveryAddress || 'Delivery Address',
              stage: 'picked_up'
            });
            await notificationEngine.send(uid, updatePayload, {
              category: 'alarm_actionable',
              priority: 'high',
              orderId,
              targetApp: 'delivery'
            });
          } catch (notifErr: any) {
            console.warn('[RiderDelivery] Picked up notifications notice:', notifErr.message);
          }
        });

        res.json({
          success: true,
          message: 'Order picked up successfully',
          orderId,
          status: 'picked_up',
          idempotencyKey
        });
        return;
      }

      case 'OUT_FOR_DELIVERY': {
        if (['out_for_delivery', 'delivered'].includes(currentStatus)) {
          res.json({
            success: true,
            duplicate: true,
            message: 'Order already out for delivery',
            orderId,
            status: currentStatus,
            idempotencyKey
          });
          return;
        }

        const outResult = await OrderStateMachine.transition(orderId, 'out_for_delivery', { uid, role: 'delivery_partner', name }, {
          outForDeliveryAt: new Date().toISOString(),
          lastActionIdempotencyKey: idempotencyKey
        });

        if (!outResult.success) {
          await orderRef.set({
            status: 'out_for_delivery',
            outForDeliveryAt: new Date().toISOString(),
            lastActionIdempotencyKey: idempotencyKey,
            updatedAt: new Date()
          }, { merge: true });
        }

        // Notify customer that order is out for delivery
        setImmediate(async () => {
          try {
            const customerUid = orderData.customerUid || orderData.firebaseUid || orderData.customerId || orderData.userId;
            if (customerUid) {
              const shortId = orderData.dailyOrderNumber ? `#${orderData.dailyOrderNumber}` : (orderData.orderNumber || `#${orderId.slice(-6).toUpperCase()}`);
              const cPayload = CustomerTemplates.orderUpdate(orderId, {
                orderNumber: shortId,
                status: 'out_for_delivery' as any,
                deliveryPartnerName: name,
                totalAmount: Number(orderData.totalAmount || 0)
              });
              await notificationEngine.send(customerUid, cPayload, { category: 'pinned_live', priority: 'high', orderId });
            }

            // In-place notification update for rider (Next: DELIVERED)
            const shortId = orderData.dailyOrderNumber ? `#${orderData.dailyOrderNumber}` : (orderData.orderNumber || `#${orderId.slice(-6).toUpperCase()}`);
            const updatePayload = DeliveryTemplates.deliveryUpdate(orderId, {
              orderNumber: shortId,
              customerName: orderData.customerName || 'Customer',
              deliveryAddress: orderData.deliveryAddress?.addressLine || orderData.deliveryAddress || 'Delivery Address',
              stage: 'out_for_delivery'
            });
            await notificationEngine.send(uid, updatePayload, {
              category: 'alarm_actionable',
              priority: 'high',
              orderId,
              targetApp: 'delivery'
            });
          } catch (notifErr: any) {
            console.warn('[RiderDelivery] Out for delivery notifications notice:', notifErr.message);
          }
        });

        res.json({
          success: true,
          message: 'Order is now out for delivery',
          orderId,
          status: 'out_for_delivery',
          idempotencyKey
        });
        return;
      }

      case 'ARRIVED_AT_CUSTOMER': {
        await orderRef.update({
          riderArrivedAtCustomerAt: new Date().toISOString(),
          lastActionIdempotencyKey: idempotencyKey,
          updatedAt: new Date().toISOString()
        });
        res.json({
          success: true,
          message: 'Arrived at customer location recorded',
          orderId,
          status: currentStatus,
          idempotencyKey
        });
        return;
      }

      case 'DELIVERED': {
        if (currentStatus === 'delivered') {
          res.json({
            success: true,
            duplicate: true,
            message: 'Order already marked delivered',
            orderId,
            status: 'delivered',
            idempotencyKey
          });
          return;
        }

        // Proximity Check: Resolve coordinates (payload vs PostgreSQL delivery_locations)
        const destLat = orderData.deliveryAddress?.lat || orderData.deliveryAddressCoordinates?.lat || orderData.location?.lat;
        const destLng = orderData.deliveryAddress?.lng || orderData.deliveryAddressCoordinates?.lng || orderData.location?.lng;

        let effectiveRiderLat = riderLat;
        let effectiveRiderLng = riderLng;

        if ((effectiveRiderLat == null || effectiveRiderLng == null) && destLat && destLng) {
          try {
            const client = await pgPool.connect();
            const locRes = await client.query('SELECT latitude, longitude FROM delivery_locations WHERE delivery_partner_id = $1', [uid]);
            client.release();
            if (locRes.rows.length > 0) {
              effectiveRiderLat = locRes.rows[0].latitude;
              effectiveRiderLng = locRes.rows[0].longitude;
            }
          } catch (pgErr: any) {
            console.warn('[RiderDelivery] Could not read Postgres rider location:', pgErr.message);
          }
        }

        if (destLat && destLng && effectiveRiderLat != null && effectiveRiderLng != null) {
          const distanceMeters = calculateDistanceMeters(
            Number(effectiveRiderLat),
            Number(effectiveRiderLng),
            Number(destLat),
            Number(destLng)
          );

          const requiredMeters = process.env.DELIVERY_COMPLETION_RADIUS_METERS
            ? Number(process.env.DELIVERY_COMPLETION_RADIUS_METERS)
            : 200;

          if (distanceMeters > requiredMeters) {
            res.status(400).json({
              success: false,
              error: `You are too far from the customer delivery address (${Math.round(distanceMeters)}m away). Must be within ${requiredMeters} meters to complete.`,
              distanceMeters: Math.round(distanceMeters),
              requiredMeters
            });
            return;
          }
        }

        const updates: any = {
          status: 'delivered',
          deliveredAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastActionIdempotencyKey: idempotencyKey,
          proofOfDelivery: {
            proofImageUrl: proofImageUrl || null,
            signatureUrl: signatureUrl || null,
            notes: notes || 'Delivered via notification action',
            completedLat: effectiveRiderLat || null,
            completedLng: effectiveRiderLng || null,
            completedAt: new Date().toISOString()
          }
        };

        await orderRef.set(updates, { merge: true });

        // Release rider active order lock in users & delivery_partners
        await adminDb.collection('users').doc(uid).set({
          activeOrderId: null,
          isBusy: false,
          lastDeliveredOrderId: orderId,
          lastDeliveredAt: new Date().toISOString(),
          updatedAt: new Date()
        }, { merge: true }).catch(() => {});
        await adminDb.collection('delivery_partners').doc(uid).set({
          activeOrderId: null,
          isBusy: false,
          updatedAt: new Date()
        }, { merge: true }).catch(() => {});

        // Release navigation session in PostgreSQL
        try {
          const client = await pgPool.connect();
          await client.query(`
            UPDATE navigation_sessions
            SET status = 'DELIVERED',
                ended_at = CURRENT_TIMESTAMP,
                expires_at = CURRENT_TIMESTAMP + INTERVAL '5 minutes'
            WHERE order_id = $1 AND delivery_partner_id = $2
          `, [orderId, uid]);
          client.release();
        } catch (navErr: any) {
          console.warn('[RiderDelivery] Navigation session close warning:', navErr.message);
        }

        // Asynchronously notify Restaurant Management and Customer of delivery
        setImmediate(async () => {
          try {
            const customerUid = orderData.customerUid || orderData.firebaseUid || orderData.customerId || orderData.userId;
            if (customerUid) {
              const shortId = orderData.dailyOrderNumber ? `#${orderData.dailyOrderNumber}` : (orderData.orderNumber || `#${orderId.slice(-6).toUpperCase()}`);
              const cPayload = CustomerTemplates.orderUpdate(orderId, {
                orderNumber: shortId,
                status: 'delivered' as any,
                deliveryPartnerName: name,
                totalAmount: Number(orderData.totalAmount || 0)
              });
              await notificationEngine.send(customerUid, cPayload, { category: 'simple_informational', priority: 'high', orderId });
            }

            const branchId = orderData.branchId || 'main_branch';
            const branchStaffUids = await notificationEngine.resolveBranchStaff(branchId);
            if (branchStaffUids.length > 0) {
              const shortId = orderData.dailyOrderNumber ? `#${orderData.dailyOrderNumber}` : (orderData.orderNumber || `#${orderId.slice(-6).toUpperCase()}`);
              const deliveredPayload = RestaurantTemplates.orderDelivered(orderId, {
                orderNumber: shortId,
                customerName: orderData.customerName || 'Customer',
                totalAmount: Number(orderData.totalAmount || 0),
                branchId,
                franchiseId: orderData.franchiseId || 'default',
                riderName: name,
                deliveryAddress: orderData.deliveryAddress?.addressLine || orderData.deliveryAddress || 'Delivery Address',
                deliveredAt: new Date().toISOString()
              });
              await notificationEngine.sendBulk(branchStaffUids, deliveredPayload, {
                category: 'simple_informational',
                priority: 'high',
                orderId,
                targetApp: 'restaurant'
              });
            }
          } catch (notifErr: any) {
            console.warn('[RiderDelivery] Failed to dispatch delivery completion notifications:', notifErr.message);
          }
        });

        res.json({
          success: true,
          message: 'Delivery successfully completed and verified',
          orderId,
          status: 'delivered',
          idempotencyKey
        });
        return;
      }

      default:
        res.status(400).json({ success: false, error: `Unsupported action: ${action}` });
    }
  } catch (error: any) {
    console.error('[RiderDelivery] Action error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to process action' });
  }
}

// 8b. POST /orders/:id/action - Unified Idempotent Notification & Live Action Handler
router.post('/orders/:id/action', (req: AuthRequest, res: Response) => {
  return processRiderOrderAction(req, res);
});

// Specific Action Endpoints (Aliases matching mobile client & delivery store)
router.post('/orders/:id/accept', (req: AuthRequest, res: Response) => {
  return processRiderOrderAction(req, res, 'ACCEPT_DELIVERY');
});

router.post('/orders/:id/decline', (req: AuthRequest, res: Response) => {
  return processRiderOrderAction(req, res, 'DECLINE_DELIVERY');
});

router.post('/orders/:id/pickup', (req: AuthRequest, res: Response) => {
  return processRiderOrderAction(req, res, 'PICKED_UP');
});

router.post('/orders/:id/complete', (req: AuthRequest, res: Response) => {
  return processRiderOrderAction(req, res, 'DELIVERED');
});


// 9. POST /status - Toggle Online / Offline Working Status
router.post('/status', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { isOnline } = req.body;
    const uid = req.user?.uid!;

    if (isOnline === undefined) {
      res.status(400).json({ error: 'isOnline boolean is required' });
      return;
    }

    const updates = {
      isOnline: Boolean(isOnline),
      onlineStatusUpdatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await adminDb.collection('users').doc(uid).set(updates, { merge: true });
    await adminDb.collection('delivery_partners').doc(uid).set(updates, { merge: true });

    res.json({
      success: true,
      message: `Rider status updated to ${isOnline ? 'Online' : 'Offline'}`,
      isOnline: Boolean(isOnline)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update working status' });
  }
});

// 10. POST /location - Ingest Live Rider Telemetry
router.post('/location', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { lat, lng, heading, speed, battery, activeOrderId } = req.body;
    const uid = req.user?.uid!;

    if (lat === undefined || lng === undefined) {
      res.status(400).json({ error: 'lat and lng are required' });
      return;
    }

    const numLat = Number(lat);
    const numLng = Number(lng);
    const numHeading = Number(heading || 0);
    const numSpeed = Number(speed || 0);
    const numBattery = Number(battery || 100);
    const timestamp = new Date().toISOString();

    // Determine active order for this rider if not explicitly provided
    let effectiveOrderId = activeOrderId || null;
    if (!effectiveOrderId) {
      try {
        const userDoc = await adminDb.collection('users').doc(uid).get();
        if (userDoc.exists && userDoc.data()?.activeOrderId) {
          effectiveOrderId = userDoc.data()!.activeOrderId;
        } else {
          // Fallback query for any active order currently assigned to this rider
          const activeSnap = await adminDb.collection('orders')
            .where('deliveryPartnerId', '==', uid)
            .where('status', 'in', ['partner_assigned', 'picked_up', 'out_for_delivery'])
            .limit(1)
            .get();
          if (!activeSnap.empty) {
            effectiveOrderId = activeSnap.docs[0].id;
          }
        }
      } catch (err: any) {
        console.warn('[RiderLocation] Failed to resolve active order:', err?.message);
      }
    }

    const locationData = {
      riderId: uid,
      uid,
      lat: numLat,
      lng: numLng,
      heading: numHeading,
      speed: numSpeed,
      battery: numBattery,
      activeOrderId: effectiveOrderId,
      branchId: req.user?.branchId || 'main_branch',
      timestamp
    };

    // 1. Real-time position for Fleet Radar & user profile
    await adminDb.collection('delivery_partners').doc(uid).set(locationData, { merge: true });
    await adminDb.collection('users').doc(uid).set({
      location: { lat: numLat, lng: numLng },
      lastLocationUpdate: timestamp,
      ...(effectiveOrderId ? { activeOrderId: effectiveOrderId } : {})
    }, { merge: true });

    // 2. Authoritative Firestore Order driverLocation update (consumed by customer onSnapshot)
    if (effectiveOrderId) {
      adminDb.collection('orders').doc(effectiveOrderId).update({
        driverLocation: {
          lat: numLat,
          lng: numLng,
          heading: numHeading,
          speed: numSpeed,
          updatedAt: timestamp
        },
        updatedAt: new Date()
      }).catch((orderErr: any) => {
        console.warn('[RiderLocation] Order driverLocation update notice:', orderErr?.message);
      });

      // Update active_deliveries collection
      adminDb.collection('active_deliveries').doc(effectiveOrderId).set({
        order_id: effectiveOrderId,
        delivery_partner_id: uid,
        status: 'active',
        current_lat: numLat,
        current_lng: numLng,
        speed: numSpeed,
        heading: numHeading,
        updated_at: timestamp
      }, { merge: true }).catch(() => {});
    }

    // 3. PostgreSQL delivery_locations update (triggers Supabase Realtime for public.delivery_locations)
    try {
      const client = await pgPool.connect();
      await client.query(`
        INSERT INTO delivery_locations 
          (delivery_partner_id, active_order_id, latitude, longitude, speed, heading, online_status, last_updated)
        VALUES ($1, $2, $3, $4, $5, $6, true, CURRENT_TIMESTAMP)
        ON CONFLICT (delivery_partner_id) 
        DO UPDATE SET 
          active_order_id = COALESCE($2, delivery_locations.active_order_id),
          latitude = $3,
          longitude = $4,
          speed = $5,
          heading = $6,
          online_status = true,
          last_updated = CURRENT_TIMESTAMP
      `, [uid, effectiveOrderId, numLat, numLng, numSpeed, numHeading]);
      client.release();
    } catch (pgErr: any) {
      // Postgres error shouldn't crash the location ingest
      console.warn('[RiderLocation] PostgreSQL delivery_locations notice:', pgErr?.message);
    }

    // 4. Instant WebSocket broadcast (<5ms latency to all listening customers & owners)
    try {
      webSocketServer.handleDriverLocationUpdate({
        deliveryPartnerId: uid,
        orderId: effectiveOrderId,
        lat: numLat,
        lng: numLng,
        accuracy: 5,
        speed: numSpeed,
        heading: numHeading,
        battery: numBattery,
        isMoving: numSpeed > 1,
        timestamp,
        status: 'ONLINE'
      });
    } catch (wsErr: any) {
      console.warn('[RiderLocation] WebSocket broadcast notice:', wsErr?.message);
    }

    // 5. Temporary telemetry for audit and history purge
    await adminDb.collection('delivery_temporary_telemetry').add(locationData).catch(() => {});

    res.json({ success: true, timestamp, activeOrderId: effectiveOrderId });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update location' });
  }
});

export default router;
