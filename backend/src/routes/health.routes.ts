import { Router } from 'express';
import { checkPostgresHealth, pgPool } from '../config/postgres.js';
import { checkSupabaseHealth } from '../config/supabase.js';
import { adminDb, isFirebaseAdminAuthenticated } from '../config/firebase.js';
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

// Dedicated Lightweight Demo Keep-Warm Endpoint (Instant 200 OK)
router.get('/health/ping', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Liveness Probe: Minimal status without disclosing process internals
router.get(['/health', '/health/liveness', '/live', '/api/live'], (_req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
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
router.get(['/ready', '/health/readiness', '/api/ready'], async (req, res) => {
  let firestoreStatus = 'healthy';
  let postgresStatus = 'healthy';
  let firestoreError: string | undefined;
  let postgresError: string | undefined;

  try {
    if (!adminDb || !isFirebaseAdminAuthenticated) {
      firestoreStatus = 'unhealthy';
      firestoreError = !isFirebaseAdminAuthenticated
        ? 'Firebase Admin unauthenticated: Missing valid service account credentials'
        : 'Firebase Admin DB instance not initialized';
    } else {
      await Promise.race([
        adminDb.collection('settings').limit(1).get(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore probe timed out after 5000ms')), 5000))
      ]);
    }
  } catch (e: any) {
    firestoreStatus = 'unhealthy';
    firestoreError = e.message;
  }

  try {
    await Promise.race([
      pgPool.query('SELECT 1'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('PostgreSQL probe timed out after 5000ms')), 5000))
    ]);
  } catch (e: any) {
    postgresStatus = 'unhealthy';
    postgresError = e.message;
  }

  const isReady = firestoreStatus === 'healthy' && postgresStatus === 'healthy';
  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ready' : 'not_ready',
    firestore: firestoreStatus,
    postgres: postgresStatus,
    checks: {
      server: 'ready',
      firestore: firestoreStatus,
      postgres: postgresStatus
    },
    errors: isReady ? undefined : { firestore: firestoreError, postgres: postgresError },
    timestamp: new Date().toISOString()
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