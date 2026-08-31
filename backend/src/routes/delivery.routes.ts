import { Router, Request, Response } from 'express';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth.middleware.js';
import { adminDb } from '../config/firebase.js';
import { FieldValue } from 'firebase-admin/firestore';
import { orderEventService } from '../services/order/OrderEventService.js';
import { pgPool } from '../config/postgres.js';
import { z } from 'zod';
import { CustomerTemplates } from '../services/notification/NotificationTemplates.js';
import { notificationEngine } from '../services/notification/NotificationEngine.js';

import { DeliveryCapacityService } from '../services/delivery/DeliveryCapacityService.js';
import { webSocketServer } from '../services/websocket/WebSocketServer.js';
import { OrderStateMachine } from '../services/order/OrderStateMachine.js';

const router = Router();

const deliveryStatusSchema = z.object({
  status: z.enum(['delivered', 'out_for_delivery', 'picked_up', 'partner_assigned', 'ready'])
});

const partnerStatusSchema = z.object({
  status: z.enum(['online', 'offline', 'busy', 'on_delivery', 'break'])
});

// Fetch restaurant availability & delivery capacity (Public endpoint used by checkout & store status)
router.get('/availability', async (req: Request, res: Response) => {
  try {
    const data = await DeliveryCapacityService.getRestaurantAvailability();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

router.use(verifyToken);

// Customer gets live location via polling
router.get('/orders/:id/location', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;
    const isStaff = ['owner', 'admin', 'restaurant_manager', 'delivery', 'delivery_partner', 'developer', 'platform_owner'].includes(user.role || '');

    const orderDoc = await adminDb.collection('orders').doc(id).get();
    if (orderDoc.exists) {
      const orderData = orderDoc.data()!;
      if (!isStaff && orderData.userId && orderData.userId !== user.uid) {
        res.status(403).json({ error: 'Access denied: You do not have permission to track this order' });
        return;
      }
    }

    const doc = await adminDb.collection('active_deliveries').doc(id).get();
    
    if (!doc.exists) {
      res.status(404).json({ error: 'Delivery tracking not found' });
      return;
    }
    
    const data = doc.data()!;
    res.json({
      currentLat: data.current_lat,
      currentLng: data.current_lng,
      status: data.status,
      updatedAt: data.updated_at
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tracking' });
  }
});

// Delivery partner gets their active tasks
router.get('/tasks', requireRole(['delivery', 'delivery_partner']), async (req: AuthRequest, res: Response) => {
  try {
    const deliveryPartnerId = req.user?.uid;
    const snapshot = await adminDb.collection('orders')
      .where('deliveryPartnerId', '==', deliveryPartnerId)
      .where('status', 'in', ['partner_assigned', 'out_for_delivery', 'preparing', 'ready', 'picked_up'])
      .get();
      
    const tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Update order status (used by delivery dashboard)
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Update order status (used by delivery dashboard)
router.patch('/orders/:id/status', requireRole(['owner', 'delivery', 'delivery_partner', 'admin']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const parsedBody = deliveryStatusSchema.safeParse(req.body);
    if (!parsedBody.success) {
      res.status(400).json({ error: 'Invalid status update for delivery partner' });
      return;
    }
    const { status } = parsedBody.data;

    // Fetch order first to get details for notification
    const orderDoc = await adminDb.collection('orders').doc(id).get();
    if (!orderDoc.exists) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    const orderData = orderDoc.data()!;

    // ── STRICT 100M DELIVERY COMPLETION VALIDATION ────────────────────────────
    if (status === 'delivered' && (req.user?.role === 'delivery' || req.user?.role === 'delivery_partner')) {
      const customerLat = orderData.deliveryAddress?.lat ?? orderData.deliveryAddressCoordinates?.lat ?? orderData.lat ?? orderData.customerLocation?.lat;
      const customerLng = orderData.deliveryAddress?.lng ?? orderData.deliveryAddressCoordinates?.lng ?? orderData.lng ?? orderData.customerLocation?.lng;

      if (customerLat != null && customerLng != null) {
        let riderLat = req.body.lat ?? req.body.latitude;
        let riderLng = req.body.lng ?? req.body.longitude;

        if (riderLat == null || riderLng == null) {
          try {
            const client = await pgPool.connect();
            const locRes = await client.query('SELECT latitude, longitude, accuracy, last_updated FROM delivery_locations WHERE delivery_partner_id = $1', [req.user.uid]);
            client.release();
            if (locRes.rows.length > 0) {
              riderLat = locRes.rows[0].latitude;
              riderLng = locRes.rows[0].longitude;
            }
          } catch (e: any) {
            console.warn('[Delivery Validation] Could not query latest Postgres location:', e.message);
          }
        }

        if (riderLat != null && riderLng != null) {
          const requiredRadiusMeters = process.env.DELIVERY_COMPLETION_RADIUS_METERS
            ? Number(process.env.DELIVERY_COMPLETION_RADIUS_METERS)
            : 200;

          const distMeters = calculateDistanceMeters(Number(riderLat), Number(riderLng), Number(customerLat), Number(customerLng));
          if (distMeters > requiredRadiusMeters) {
            res.status(400).json({
              error: `Delivery cannot be completed yet. You must be within ${requiredRadiusMeters} meters of the customer location.`,
              distanceMeters: Math.round(distMeters),
              requiredDistanceMeters: requiredRadiusMeters,
            });
            return;
          }
        }
      }
    }

    const updateData: Record<string, any> = {
      status: status,
      updatedAt: FieldValue.serverTimestamp()
    };
    if (status === 'delivered') {
      updateData.deliveredAt = FieldValue.serverTimestamp();
      if (req.body.deliveryProof) {
        updateData.deliveryProof = req.body.deliveryProof;
      }
    }

    await adminDb.collection('orders').doc(id).update(updateData);
    
    // Synchronous Dispatch
    setImmediate(async () => {
      try {
        const customerFirebaseUid = orderData.customerUid || orderData.firebaseUid || orderData.customerId || orderData.userId || orderData.user_id;
        if (customerFirebaseUid) {
          const shortId = orderData.dailyOrderNumber || `#${id.slice(-6).toUpperCase()}`;
          const cPayload = CustomerTemplates.orderUpdate(id, {
            orderNumber: shortId,
            status: status as any,
            deliveryPartnerName: orderData.deliveryPartnerName || 'Your Delivery Partner',
            totalAmount: Number(orderData.totalAmount || 0),
          });
          const category = status === 'delivered' ? 'simple_informational' : 'pinned_live';
          await notificationEngine.send(customerFirebaseUid, cPayload, { category, priority: 'high', orderId: id });
        }
      } catch (e: any) {
        console.error('[Delivery Routes] Async notification failed:', e.message);
      }
    });

    // Emit event so emails are triggered
    try {
      orderEventService.emitStatusChange(id, status as any, req.user?.uid || 'system');
    } catch (e: any) {
      console.warn('[Delivery Routes] Event emit warning:', e.message);
    }
    
    // Auto-update rider status and navigation session expiry if delivered
    if (status === 'delivered' && req.user?.uid) {
      try {
        await DeliveryCapacityService.setPartnerStatus(req.user.uid, 'online', null); // becomes available again
      } catch (e: any) {
        console.warn('[Delivery Routes] setPartnerStatus warning:', e.message);
      }
      
      // Update PostgreSQL navigation session to DELIVERED with 5-minute expiry
      try {
        const client = await pgPool.connect();
        await client.query(`
          UPDATE navigation_sessions
          SET status = 'DELIVERED',
              ended_at = CURRENT_TIMESTAMP,
              expires_at = CURRENT_TIMESTAMP + INTERVAL '5 minutes'
          WHERE order_id = $1 AND delivery_partner_id = $2
        `, [id, req.user.uid]);
        client.release();
      } catch (e: any) {
        console.warn('[Delivery Routes] Navigation session cleanup trigger warning:', e.message);
      }
    }

    res.json({ message: `Order status updated to ${status}` });
  } catch (error) {
    console.error('[Delivery Routes] Failed to update order status:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// Update rider availability status (online/offline/busy)
router.patch('/partner-status', requireRole(['delivery', 'delivery_partner', 'owner']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const partnerId = req.user?.uid;
    const parsedBody = partnerStatusSchema.safeParse(req.body);
    if (!parsedBody.success || !partnerId) {
      res.status(400).json({ error: 'Invalid status update' });
      return;
    }
    await DeliveryCapacityService.setPartnerStatus(partnerId, parsedBody.data.status);
    res.json({ success: true, status: parsedBody.data.status });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update partner status' });
  }
});



// Join the notify queue
router.post('/notify-queue', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const customerId = req.user?.uid;
    if (!customerId) return res.status(401).json({ error: 'Unauthorized' });
    await DeliveryCapacityService.addToNotifyQueue(customerId, req.body.fcmToken);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to join queue' });
  }
});

// Update live delivery location (supports /orders/:id/location and /location)
const handleLocationUpdate = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { lat, lng, latitude, longitude, speed, heading, accuracy, orderId } = req.body;

    const actualLat = lat !== undefined ? lat : latitude;
    const actualLng = lng !== undefined ? lng : longitude;
    const targetOrderId = id || orderId || null;

    if (actualLat === undefined || actualLng === undefined) {
      res.status(400).json({ error: 'Missing coordinates' });
      return;
    }

    const deliveryPartnerId = req.user?.uid;
    if (!deliveryPartnerId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // 1. Update PostgreSQL delivery_locations (Triggers Supabase Realtime)
    try {
      const client = await pgPool.connect();
      await client.query(`
        INSERT INTO delivery_locations 
          (delivery_partner_id, active_order_id, latitude, longitude, accuracy, speed, heading, online_status, last_updated)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true, CURRENT_TIMESTAMP)
        ON CONFLICT (delivery_partner_id) 
        DO UPDATE SET 
          active_order_id = COALESCE($2, delivery_locations.active_order_id),
          latitude = $3,
          longitude = $4,
          accuracy = $5,
          speed = $6,
          heading = $7,
          online_status = true,
          last_updated = CURRENT_TIMESTAMP
      `, [deliveryPartnerId, targetOrderId, actualLat, actualLng, accuracy || null, speed || null, heading || null]);
      client.release();
    } catch (pgErr: any) {
      console.warn('[LocationUpdate] Postgres update warning:', pgErr.message);
    }

    // 2. Update Firestore active_deliveries (Triggers Firestore Polling Fallback)
    const docId = targetOrderId || deliveryPartnerId;
    await adminDb.collection('active_deliveries').doc(docId).set({
      order_id: targetOrderId,
      delivery_partner_id: deliveryPartnerId,
      status: 'active',
      current_lat: actualLat,
      current_lng: actualLng,
      speed: speed || 0,
      heading: heading || 0,
      updated_at: new Date().toISOString()
    }, { merge: true });

    // 3. Check Delivery Radius Warning
    const settingsSnap = await adminDb.collection('settings').doc('store').get();
    const settings = settingsSnap.data() || {};
    const storeLat = settings.restaurantLat || 28.6139; // Default fallback
    const storeLng = settings.restaurantLng || 77.2090;
    const maxRadius = settings.deliveryRadiusKm || 5;

    const distance = DeliveryCapacityService.getDistanceKm(storeLat, storeLng, actualLat, actualLng);
    if (distance > maxRadius) {
      // Broadcast warning to owner via websockets/firestore
      const warningMsg = `⚠ Delivery Partner ${deliveryPartnerId} is outside delivery radius (${distance.toFixed(1)}km away).`;
      await adminDb.collection('owner_alerts').add({
        type: 'radius_warning',
        message: warningMsg,
        partnerId: deliveryPartnerId,
        distance,
        timestamp: FieldValue.serverTimestamp(),
        acknowledged: false
      });
      // Optionally emit websocket event to owner dashboard
      webSocketServer.broadcastToRole('owner', { type: 'radius_warning', data: { partnerId: deliveryPartnerId, distance, maxRadius } });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Live tracking error:", error);
    res.status(500).json({ error: 'Failed to update location' });
  }
};

router.post('/orders/:id/location', requireRole(['delivery', 'delivery_partner']), handleLocationUpdate);
router.post('/location', requireRole(['delivery', 'delivery_partner']), handleLocationUpdate);


// ─── POST /orders/:id/assign-partner — Manual Rider Assignment ─────────────
router.post('/orders/:id/assign-partner', requireRole(['restaurant_manager', 'owner', 'admin', 'developer']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { deliveryPartnerId, deliveryPartnerName, deliveryPartnerPhone } = req.body;

    if (!deliveryPartnerId) {
      res.status(400).json({ error: 'deliveryPartnerId is required' });
      return;
    }

    // Verify rider eligibility: must be online and not handling another active order
    const riderDoc = await adminDb.collection('users').doc(deliveryPartnerId).get();
    if (!riderDoc.exists) {
      res.status(404).json({ error: 'Delivery partner not found' });
      return;
    }

    const rData = riderDoc.data()!;
    if (rData.isOnline === false || rData.isActive === false) {
      res.status(400).json({ error: 'Selected delivery partner is currently offline or inactive.' });
      return;
    }

    if (rData.activeOrderId && rData.activeOrderId !== id) {
      res.status(400).json({ error: 'Selected delivery partner is already on an active delivery assignment.' });
      return;
    }

    const result = await OrderStateMachine.transition(
      id,
      'partner_assigned',
      { uid: req.user!.uid, role: req.user!.role || 'restaurant_manager', name: req.user!.email },
      {
        deliveryPartnerId,
        deliveryPartnerName: deliveryPartnerName || rData.name || 'Delivery Partner',
        deliveryPartnerPhone: deliveryPartnerPhone || rData.phone || '',
        manualAssignment: true,
        assignedByUid: req.user!.uid,
      }
    );

    if (!result.success) {
      res.status(400).json({ error: result.error || 'Failed to assign rider' });
      return;
    }

    // Set rider busy status
    await adminDb.collection('users').doc(deliveryPartnerId).update({
      activeOrderId: id,
      isBusy: true,
      updatedAt: new Date(),
    });

    res.json({ success: true, message: 'Rider manually assigned successfully', orderId: id, deliveryPartnerId });
  } catch (err: any) {
    console.error('[Delivery Routes] Manual assign error:', err);
    res.status(500).json({ error: 'Failed to assign rider' });
  }
});

// ─── POST /orders/:id/decline — Rider Assignment Decline & Reassignment ────
router.post('/orders/:id/decline', requireRole(['delivery', 'delivery_partner', 'owner', 'admin']), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const riderId = req.user?.uid;
    const { reason } = req.body;

    const orderDoc = await adminDb.collection('orders').doc(id).get();
    if (!orderDoc.exists) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const oData = orderDoc.data()!;
    const declinedPartners = Array.isArray(oData.declinedPartnerIds) ? [...oData.declinedPartnerIds] : [];
    if (riderId && !declinedPartners.includes(riderId)) {
      declinedPartners.push(riderId);
    }

    // Clear active rider assignment on order and record declined ID
    await adminDb.collection('orders').doc(id).update({
      deliveryPartnerId: null,
      deliveryPartnerName: null,
      deliveryPartnerPhone: null,
      declinedPartnerIds: declinedPartners,
      lastDeclineReason: reason || 'Rider declined assignment',
      updatedAt: new Date(),
    });

    // Release rider busy state
    if (riderId) {
      await adminDb.collection('users').doc(riderId).update({
        activeOrderId: null,
        isBusy: false,
        updatedAt: new Date(),
      }).catch(() => {});
    }

    // Auto-dispatch next available eligible rider in the background
    const { RiderDispatchEngine } = await import('../services/delivery/RiderDispatchEngine.js');
    RiderDispatchEngine.autoDispatchRider(id).catch((e) =>
      console.warn('[Delivery Routes] Reassignment notice:', e.message)
    );

    res.json({ success: true, message: 'Assignment declined. Next available rider is being dispatched.', orderId: id });
  } catch (err: any) {
    console.error('[Delivery Routes] Decline error:', err);
    res.status(500).json({ error: 'Failed to process rider decline' });
  }
});

export default router;
