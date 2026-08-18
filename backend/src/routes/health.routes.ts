import { Router } from 'express';
import { pgPool } from '../config/postgres.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { execSync } from 'child_process';
import os from 'os';

const router = Router();

let cachedCommitHash: string | null = null;
let cachedBuildTimestamp: string | null = null;

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
    api_version: 'v1.1.0',
    frontend_version: process.env.VITE_APP_VERSION || '1.1.0',
    native_version: '1.1.0',
    build_hash: process.env.VITE_APP_BUILD_HASH || cachedCommitHash,
    git_commit: cachedCommitHash,
    build_timestamp: cachedBuildTimestamp,
    environment: process.env.NODE_ENV || 'development'
  });
});

router.get('/metrics', requireAuth, requireRole(['owner', 'admin']), async (req, res) => {
  let client = null;
  const metrics: any = {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };

  try {
    client = await pgPool.connect();

    // DB Size Estimate
    const dbSizeRes = await client.query(`SELECT pg_size_pretty(pg_database_size(current_database())) as size;`);
    metrics.dbSize = dbSizeRes.rows[0]?.size || 'Unknown';

    // Active Users
    const activeUsersRes = await client.query(`SELECT COUNT(*) as count FROM device_heartbeats WHERE is_online = true;`);
    metrics.activeUsers = parseInt(activeUsersRes.rows[0]?.count || '0', 10);

    // Queue Size
    const queueSizeRes = await client.query(`SELECT COUNT(*) as count FROM notification_queue;`);
    metrics.notificationQueueSize = parseInt(queueSizeRes.rows[0]?.count || '0', 10);

    // Deliveries
    const deliveriesRes = await client.query(`SELECT COUNT(*) as count FROM active_deliveries;`);
    metrics.activeDeliveries = parseInt(deliveriesRes.rows[0]?.count || '0', 10);

    res.json({ success: true, limited: false, metrics });
  } catch (error: any) {
    console.error(JSON.stringify({ 
      event: 'HEALTH_MONITOR_DB_ERROR', 
      message: 'Failed to fetch database metrics', 
      error: error.message 
    }));
    // Return graceful limited metrics instead of 500 error
    res.status(200).json({ success: true, limited: true, metrics });
  } finally {
    if (client) {
      client.release();
    }
  }
});

export default router;
