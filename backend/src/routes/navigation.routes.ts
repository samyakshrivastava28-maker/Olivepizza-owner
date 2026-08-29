import { Router, Request, Response } from 'express';
import { verifyToken, requireRole, AuthRequest } from '../middleware/auth.middleware.js';
import { pgPool } from '../config/postgres.js';
import { adminDb } from '../config/firebase.js';

const router = Router();
const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';

export interface LatLng {
  lat: number;
  lng: number;
}

function decodePolyline(encoded: string): [number, number][] {
  const coords: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coords.push([lng / 1e5, lat / 1e5]); // [lng, lat]
  }
  return coords;
}

// ─── POST /api/navigation/route ──────────────────────────────────────────────
router.post('/route', verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { origin, destination, orderId } = req.body;

    if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
      res.status(400).json({ error: 'Origin and destination coordinates are required' });
      return;
    }

    const url = `${OSRM_BASE}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=polyline&steps=true&annotations=false`;
    const fetchRes = await fetch(url, { signal: AbortSignal.timeout(8000) });

    if (!fetchRes.ok) {
      throw new Error(`OSRM API error: ${fetchRes.status}`);
    }

    const json = await fetchRes.json();
    if (!json.routes?.[0]) {
      res.status(404).json({ error: 'No route found between coordinates' });
      return;
    }

    const route = json.routes[0];
    const coordinates = decodePolyline(route.geometry);

    const steps = [];
    for (const leg of route.legs || []) {
      for (const step of leg.steps || []) {
        steps.push({
          distance: step.distance,
          duration: step.duration,
          name: step.name || '',
          maneuver: {
            type: step.maneuver?.type || 'continue',
            modifier: step.maneuver?.modifier,
            bearing_before: step.maneuver?.bearing_before,
            bearing_after: step.maneuver?.bearing_after,
          },
        });
      }
    }

    const geojson: any = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates,
      },
    };

    res.json({
      coordinates,
      distanceMeters: Math.round(route.distance),
      durationSeconds: Math.round(route.duration),
      steps,
      geojson,
      orderId: orderId || null,
    });
  } catch (err: any) {
    console.error('[NavigationRoute] Route calculation error:', err.message);
    res.status(500).json({ error: 'Failed to calculate navigation route' });
  }
});

// ─── POST /api/navigation/session/start ─────────────────────────────────────
router.post('/session/start', verifyToken, requireRole(['delivery', 'delivery_partner']), async (req: AuthRequest, res: Response) => {
  try {
    const { orderId } = req.body;
    const deliveryPartnerId = req.user?.uid;

    if (!orderId || !deliveryPartnerId) {
      res.status(400).json({ error: 'Missing orderId or deliveryPartnerId' });
      return;
    }

    const sessionId = `nav_${orderId}_${deliveryPartnerId}`;
    const client = await pgPool.connect();

    try {
      await client.query(`
        INSERT INTO navigation_sessions 
          (id, order_id, delivery_partner_id, status, started_at, expires_at)
        VALUES ($1, $2, $3, 'ACTIVE', CURRENT_TIMESTAMP, NULL)
        ON CONFLICT (id) 
        DO UPDATE SET 
          status = 'ACTIVE',
          ended_at = NULL,
          expires_at = NULL
      `, [sessionId, orderId, deliveryPartnerId]);
    } finally {
      client.release();
    }

    res.json({ success: true, sessionId, status: 'ACTIVE' });
  } catch (err: any) {
    console.error('[NavigationSession] Start session error:', err.message);
    res.status(500).json({ error: 'Failed to start navigation session' });
  }
});

// ─── POST /api/navigation/session/update ────────────────────────────────────
router.post('/session/update', verifyToken, requireRole(['delivery', 'delivery_partner']), async (req: AuthRequest, res: Response) => {
  try {
    const { orderId, latitude, longitude, speed, heading, accuracy } = req.body;
    const deliveryPartnerId = req.user?.uid;

    if (!orderId || latitude === undefined || longitude === undefined || !deliveryPartnerId) {
      res.status(400).json({ error: 'Missing required navigation update fields' });
      return;
    }

    const sessionId = `nav_${orderId}_${deliveryPartnerId}`;
    const client = await pgPool.connect();

    try {
      // Ensure session is ACTIVE
      await client.query(`
        INSERT INTO navigation_sessions 
          (id, order_id, delivery_partner_id, status, started_at, expires_at)
        VALUES ($1, $2, $3, 'ACTIVE', CURRENT_TIMESTAMP, NULL)
        ON CONFLICT (id) 
        DO UPDATE SET status = 'ACTIVE', expires_at = NULL
      `, [sessionId, orderId, deliveryPartnerId]);

      // Record telemetry point
      await client.query(`
        INSERT INTO navigation_points 
          (session_id, order_id, latitude, longitude, speed, heading, accuracy, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      `, [sessionId, orderId, latitude, longitude, speed || null, heading || null, accuracy || null]);

    } finally {
      client.release();
    }

    res.json({ success: true, sessionId });
  } catch (err: any) {
    console.error('[NavigationSession] Update session error:', err.message);
    res.status(500).json({ error: 'Failed to record navigation telemetry' });
  }
});

// ─── POST /api/navigation/session/stop ─────────────────────────────────────
router.post('/session/stop', verifyToken, requireRole(['delivery', 'delivery_partner']), async (req: AuthRequest, res: Response) => {
  try {
    const { orderId } = req.body;
    const deliveryPartnerId = req.user?.uid;

    if (!orderId || !deliveryPartnerId) {
      res.status(400).json({ error: 'Missing orderId or deliveryPartnerId' });
      return;
    }

    const sessionId = `nav_${orderId}_${deliveryPartnerId}`;
    const client = await pgPool.connect();

    try {
      await client.query(`
        UPDATE navigation_sessions 
        SET status = 'STOPPED', 
            ended_at = CURRENT_TIMESTAMP, 
            expires_at = CURRENT_TIMESTAMP + INTERVAL '5 minutes'
        WHERE id = $1 AND status = 'ACTIVE'
      `, [sessionId]);
    } finally {
      client.release();
    }

    res.json({ success: true, sessionId, status: 'STOPPED', expiresAtInMinutes: 5 });
  } catch (err: any) {
    console.error('[NavigationSession] Stop session error:', err.message);
    res.status(500).json({ error: 'Failed to stop navigation session' });
  }
});

export default router;
