import { Router } from 'express';
import { checkPostgresHealth, pgPool } from '../config/postgres.js';
import { checkSupabaseHealth } from '../config/supabase.js';
import { adminDb } from '../config/firebase.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { execSync } from 'child_process';

const router = Router();

let cachedCommitHash: string | null = null;
let cachedBuildTimestamp: string | null = null;

// Lightweight in-memory demo keep-warm telemetry
const demoKeepWarmStats = {
  totalPings: 0,
  lastPingTimestamp: new Date().toISOString(),
  lastOrigin: 'initial',
  lastUserAgent: 'system'
};

// Dedicated Lightweight Demo Keep-Warm Endpoint (No DB queries, no notifications, instant 200 OK)
router.get('/health/ping', (req, res) => {
  demoKeepWarmStats.totalPings += 1;
  demoKeepWarmStats.lastPingTimestamp = new Date().toISOString();
  demoKeepWarmStats.lastOrigin = (req.headers['origin'] || req.headers['host'] || 'unknown') as string;
  demoKeepWarmStats.lastUserAgent = (req.headers['user-agent'] || 'unknown') as string;

  res.json({
    status: 'ok',
    service: 'olive-pizza-backend',
    demoKeepWarm: true,
    uptime: process.uptime(),
    timestamp: demoKeepWarmStats.lastPingTimestamp,
    totalPings: demoKeepWarmStats.totalPings
  });
});

// Liveness Probe: Process uptime & runtime version
router.get(['/health', '/health/liveness'], (req, res) => {
  res.json({
    status: 'ok',
    service: 'Olive Pizza Standalone Owner Backend',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    keepWarmStats: {
      totalPings: demoKeepWarmStats.totalPings,
      lastPing: demoKeepWarmStats.lastPingTimestamp
    }
  });
});

// Version info
router.get('/version', (req, res) => {
  res.json({
    status: 'ok',
    api_version: 'v2.1.0'
  });
});

/**
 * Readiness Probe:
 * Returns simple pass/fail status without exposing internal infrastructure topology or connection metrics.
 */
router.get(['/ready', '/health/readiness'], async (req, res) => {
  try {
    const pgHealth = await checkPostgresHealth();
    let firestoreConnected = false;

    if (adminDb) {
      await adminDb.collection('settings').limit(1).get();
      firestoreConnected = true;
    }

    const isCoreReady = pgHealth.connected && firestoreConnected;

    res.status(isCoreReady ? 200 : 503).json({
      status: isCoreReady ? 'ready' : 'unready'
    });
  } catch (err: any) {
    res.status(503).json({ status: 'unready' });
  }
});

// Admin metrics endpoint
router.get('/metrics', requireAuth, requireRole(['owner', 'admin']), async (req, res) => {
  let client = null;
  const metrics: any = {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };

  try {
    client = await pgPool.connect();
    const dbSizeRes = await client.query(`SELECT pg_size_pretty(pg_database_size(current_database())) as size;`);
    metrics.dbSize = dbSizeRes.rows[0]?.size || 'Unknown';

    const queueSizeRes = await client.query(`SELECT COUNT(*) as count FROM notification_queue;`);
    metrics.notificationQueueSize = parseInt(queueSizeRes.rows[0]?.count || '0', 10);

    res.json({ success: true, limited: false, metrics });
  } catch (error: any) {
    res.status(200).json({ success: true, limited: true, metrics, error: error.message });
  } finally {
    if (client) client.release();
  }
});

export default router;