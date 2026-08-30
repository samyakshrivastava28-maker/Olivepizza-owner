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
  if (!cachedCommitHash) {
    try {
      cachedCommitHash = execSync('git rev-parse HEAD').toString().trim();
    } catch {
      cachedCommitHash = 'unknown';
    }
  }
  if (!cachedBuildTimestamp) {
    cachedBuildTimestamp = process.env.VITE_APP_BUILD_TIMESTAMP || new Date().toISOString();
  }

  res.json({
    status: 'ok',
    api_version: 'v2.1.0',
    build_hash: process.env.VITE_APP_BUILD_HASH || cachedCommitHash,
    git_commit: cachedCommitHash,
    build_timestamp: cachedBuildTimestamp,
    environment: process.env.NODE_ENV || 'production'
  });
});

/**
 * Readiness Probe:
 * CORE READY requires PostgreSQL + Firestore.
 * Subsystems (Supabase live navigation, Google Sheets) are reported independently
 * and do NOT fail the core backend readiness.
 */
router.get(['/ready', '/health/readiness'], async (req, res) => {
  const pgHealth = await checkPostgresHealth();

  let firestoreConnected = false;
  let firestoreLatency = 0;
  const fsStart = Date.now();
  try {
    if (adminDb) {
      // Light ping to Firestore
      await adminDb.collection('settings').limit(1).get();
      firestoreConnected = true;
      firestoreLatency = Date.now() - fsStart;
    }
  } catch {
    firestoreConnected = false;
  }

  // Non-blocking subsystem check (Supabase GPS navigation)
  const supabaseHealth = await checkSupabaseHealth();

  const isCoreReady = pgHealth.connected && firestoreConnected;

  res.status(isCoreReady ? 200 : 503).json({
    status: isCoreReady ? 'ready' : 'degraded',
    core: {
      ready: isCoreReady,
      postgres: {
        status: pgHealth.connected ? 'connected' : 'disconnected',
        latencyMs: pgHealth.latencyMs,
        pool: pgHealth.poolStatus,
      },
      firestore: {
        status: firestoreConnected ? 'connected' : 'disconnected',
        latencyMs: firestoreLatency,
      }
    },
    subsystems: {
      supabaseNavigation: {
        status: supabaseHealth.connected ? 'active' : 'degraded',
        latencyMs: supabaseHealth.latencyMs,
        role: 'live_gps_telemetry_only',
      },
      googleSheets: {
        status: process.env.GOOGLE_SHEET_SPREADSHEET_ID ? 'configured' : 'optional',
        role: 'asynchronous_monthly_reporting',
      },
      lookerStudio: {
        status: 'active_downstream',
        role: 'business_analytics',
      }
    },
    timestamp: new Date().toISOString(),
  });
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