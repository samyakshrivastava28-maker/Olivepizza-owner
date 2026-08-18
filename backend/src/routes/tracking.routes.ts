import { Router, Request, Response } from 'express';
import { pgPool } from '../config/postgres.js';
import { adminDb } from '../config/firebase.js';
import { verifyToken, requireRole, optionalAuth, AuthRequest } from '../middleware/auth.middleware.js';
import { generateTrackingToken, verifyTrackingToken } from '../utils/trackingToken.js';

const router = Router();

// Helper to calculate distance in km using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Helper to calculate ETA (assuming average speed of 30 km/h in city if no speed provided)
function calculateETA(distanceKm: number, speedKmh?: number): number {
  const avgSpeed = speedKmh && speedKmh > 0 ? speedKmh : 30;
  return Math.ceil((distanceKm / avgSpeed) * 60); // returns minutes
}

import { webSocketServer } from '../services/websocket/WebSocketServer.js';

// Default Olive Pizza Main Branch Coordinates (Rajnandgaon)
const DEFAULT_BRANCH_LAT = 21.0967;
const DEFAULT_BRANCH_LNG = 81.0315;
const DEFAULT_MAX_DELIVERY_RADIUS_KM = 12.0;

// Updates delivery partner location
router.post('/location/update', verifyToken, requireRole(['delivery', 'delivery_partner']), async (req: AuthRequest, res: Response) => {
  try {
    const { partnerId, orderId, latitude, longitude, lat, lng, accuracy, speed, heading, battery, isMoving } = req.body;
    const actualPartnerId = partnerId || req.user?.uid;
    const actualLat = latitude !== undefined ? latitude : lat;
    const actualLng = longitude !== undefined ? longitude : lng;
    
    if (!actualPartnerId || actualLat === undefined || actualLng === undefined) {
      return res.status(400).json({ error: 'Missing required location data' });
    }

    if (req.user?.uid !== actualPartnerId && req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Cannot update other partner locations' });
    }

    // ⚡ INSTANT WEBSOCKET BROADCAST (<5ms latency to all listening customers & owners)
    webSocketServer.handleDriverLocationUpdate({
      deliveryPartnerId: actualPartnerId,
      orderId: orderId || null,
      lat: Number(actualLat),
      lng: Number(actualLng),
      accuracy: accuracy || 5,
      speed: speed || 0,
      heading: heading || 0,
      battery: battery || 100,
      isMoving: isMoving !== undefined ? isMoving : (Number(speed || 0) > 1),
      timestamp: new Date().toISOString(),
      status: 'ONLINE'
    });

    const client = await pgPool.connect();
    
    // 1. Update PostgreSQL delivery_locations (Triggers Supabase Realtime)
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
    `, [actualPartnerId, orderId || null, actualLat, actualLng, accuracy || null, speed || null, heading || null]);

    // If there's an active order, update distance and ETA in delivery_routes
    if (orderId) {
      const routeResult = await client.query('SELECT customer_lat, customer_lng FROM delivery_routes WHERE order_id = $1 AND delivery_partner_id = $2', [orderId, actualPartnerId]);
      
      if (routeResult.rows.length > 0) {
        const route = routeResult.rows[0];
        if (route.customer_lat && route.customer_lng) {
          const distance = calculateDistance(actualLat, actualLng, route.customer_lat, route.customer_lng);
          const eta = calculateETA(distance, speed ? speed * 3.6 : 30); // speed in m/s to km/h if available

          await client.query(`
            UPDATE delivery_routes 
            SET distance_km = $1, estimated_minutes = $2 
            WHERE order_id = $3 AND delivery_partner_id = $4
          `, [distance, eta, orderId, actualPartnerId]);
        }
      }

      // Also update Firestore active_deliveries asynchronously
      try {
        await adminDb.collection('active_deliveries').doc(orderId).set({
          order_id: orderId,
          delivery_partner_id: actualPartnerId,
          status: 'active',
          current_lat: actualLat,
          current_lng: actualLng,
          speed: speed || 0,
          heading: heading || 0,
          updated_at: new Date().toISOString()
        }, { merge: true });
      } catch (fErr: any) {
        console.warn('[TrackingRoute] Firestore update warning:', fErr.message);
      }
    }

    client.release();
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Returns current location of a partner
router.get('/location/:partnerId', async (req: Request, res: Response) => {
  try {
    const { partnerId } = req.params;
    const client = await pgPool.connect();
    const result = await client.query('SELECT * FROM delivery_locations WHERE delivery_partner_id = $1', [partnerId]);
    client.release();

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error getting location:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get active deliveries for Owner
router.get('/active', verifyToken, requireRole(['owner']), async (req: Request, res: Response) => {
  try {
    const client = await pgPool.connect();
    // Get all online partners with their active routes
    const result = await client.query(`
      SELECT l.*, r.distance_km, r.estimated_minutes, r.order_id
      FROM delivery_locations l
      LEFT JOIN delivery_routes r ON l.active_order_id = r.order_id
      WHERE l.online_status = true
    `);
    client.release();
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting active tracking:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Tracking Token Endpoint — Generate signed token for an order ────────────
// Called by authenticated clients to get a token for embedding in shareable links.
router.get('/token/:orderId', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { orderId } = req.params;
    const orderDoc = await adminDb.collection('orders').doc(orderId).get();
    if (!orderDoc.exists) return res.status(404).json({ error: 'Order not found' });
    const order = orderDoc.data()!;

    const isOwner = req.user?.role === 'owner' || req.user?.role === 'admin';
    const isCustomer = req.user?.uid === order.userId || req.user?.uid === order.customerId;
    const isPartner = req.user?.uid === order.deliveryPartnerId;

    if (!isOwner && !isCustomer && !isPartner) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const token = generateTrackingToken(orderId);
    return res.json({ token, expiresInHours: 4 });
  } catch (error) {
    console.error('Error generating tracking token:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Returns Partner location, ETA, Distance for an order
// Accepts EITHER a valid signed trackingToken query param (unauthenticated deep links)
// OR an authenticated session where the user is the order customer/owner/partner.
router.get('/order/:orderId', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { orderId } = req.params;

    // Security Check: Verify user is authorized to view this GPS data
    const orderDoc = await adminDb.collection('orders').doc(orderId).get();
    if (!orderDoc.exists) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const order = orderDoc.data();
    const isOwner = req.user?.role === 'owner' || req.user?.role === 'admin';
    const isAssignedPartner = req.user?.uid === order?.deliveryPartnerId;
    const isCustomer = req.user?.uid === order?.userId || req.user?.uid === order?.customerId;

    // Also allow access via a valid signed tracking token (push notification deep links)
    const rawToken = req.query.trackingToken as string | undefined;
    const tokenOrderId = rawToken ? verifyTrackingToken(rawToken) : null;
    const hasValidToken = tokenOrderId === orderId;

    if (!isOwner && !isAssignedPartner && !isCustomer && !hasValidToken) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to track this order' });
    }

    const client = await pgPool.connect();
    
    const result = await client.query(`
      SELECT r.distance_km, r.estimated_minutes, r.customer_lat, r.customer_lng, r.restaurant_lat, r.restaurant_lng,
             l.latitude as partner_lat, l.longitude as partner_lng, l.speed, l.heading, l.last_updated, l.delivery_partner_id
      FROM delivery_routes r
      LEFT JOIN delivery_locations l ON r.delivery_partner_id = l.delivery_partner_id
      WHERE r.order_id = $1
    `, [orderId]);
    
    client.release();

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tracking not found for order' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error getting tracking info:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Creates tracking session
router.post('/navigation/start', verifyToken, requireRole(['delivery_partner']), async (req: AuthRequest, res: Response) => {
  try {
    const { orderId, partnerId, customerLat, customerLng, restaurantLat, restaurantLng } = req.body;
    
    if (!orderId || !partnerId) {
      return res.status(400).json({ error: 'Missing orderId or partnerId' });
    }

    if (req.user?.uid !== partnerId) {
      return res.status(403).json({ error: 'Forbidden: Cannot start tracking for other partners' });
    }

    const client = await pgPool.connect();
    
    await client.query(`
      INSERT INTO delivery_routes 
        (order_id, delivery_partner_id, customer_lat, customer_lng, restaurant_lat, restaurant_lng)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [orderId, partnerId, customerLat, customerLng, restaurantLat, restaurantLng]);
    
    await client.query(`
      UPDATE delivery_locations 
      SET active_order_id = $1 
      WHERE delivery_partner_id = $2
    `, [orderId, partnerId]);

    client.release();
    res.json({ success: true });
  } catch (error) {
    console.error('Error starting navigation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Ends tracking session
router.post('/navigation/stop', verifyToken, requireRole(['delivery_partner']), async (req: AuthRequest, res: Response) => {
  try {
    const { orderId, partnerId } = req.body;
    
    if (!orderId || !partnerId) {
      return res.status(400).json({ error: 'Missing orderId or partnerId' });
    }

    if (req.user?.uid !== partnerId) {
      return res.status(403).json({ error: 'Forbidden: Cannot stop tracking for other partners' });
    }

    const client = await pgPool.connect();
    
    // Get route data before deleting
    const routeResult = await client.query('SELECT * FROM delivery_routes WHERE order_id = $1', [orderId]);
    
    if (routeResult.rows.length > 0) {
      const route = routeResult.rows[0];
      
      // Move to history
      await client.query(`
        INSERT INTO delivery_history 
          (order_id, delivery_partner_id, pickup_time, delivery_time, distance_km)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4)
      `, [orderId, partnerId, route.created_at, route.distance_km]);
      
      // Delete route
      await client.query('DELETE FROM delivery_routes WHERE order_id = $1', [orderId]);
    }
    
    // Clear active order from location
    await client.query(`
      UPDATE delivery_locations 
      SET active_order_id = NULL 
      WHERE delivery_partner_id = $1
    `, [partnerId]);

    client.release();
    res.json({ success: true });
  } catch (error) {
    console.error('Error stopping navigation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update offline status
router.post('/status', verifyToken, requireRole(['delivery_partner']), async (req: AuthRequest, res: Response) => {
  try {
    const { partnerId, status } = req.body; // status: boolean

    if (req.user?.uid !== partnerId) {
      return res.status(403).json({ error: 'Forbidden: Cannot update status for other partners' });
    }
    const client = await pgPool.connect();
    
    await client.query(`
      UPDATE delivery_locations 
      SET online_status = $1 
      WHERE delivery_partner_id = $2
    `, [status, partnerId]);

    client.release();
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check if customer coordinate is within store delivery radius
router.post('/boundary-check', async (req: Request, res: Response) => {
  try {
    const { lat, lng, branchLat, branchLng, maxRadiusKm } = req.body;
    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const bLat = Number(branchLat || DEFAULT_BRANCH_LAT);
    const bLng = Number(branchLng || DEFAULT_BRANCH_LNG);
    const radiusLimit = Number(maxRadiusKm || DEFAULT_MAX_DELIVERY_RADIUS_KM);

    const distanceKm = Number(calculateDistance(Number(lat), Number(lng), bLat, bLng).toFixed(2));
    const inside = distanceKm <= radiusLimit;
    const estimatedMinutes = calculateETA(distanceKm, 25);

    res.json({
      success: true,
      inside,
      distanceKm,
      maxRadiusKm: radiusLimit,
      estimatedMinutes,
      message: inside ? 'Location is within our delivery zone' : `Location is ${distanceKm} km away, which exceeds our maximum delivery radius of ${radiusLimit} km.`
    });
  } catch (error: any) {
    console.error('Error in boundary check:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get real-time driver active fleet status
router.get('/active-drivers', async (_req: Request, res: Response) => {
  try {
    const activeDrivers = webSocketServer.getActiveDriverLocations();
    res.json({ success: true, count: activeDrivers.length, data: activeDrivers });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

