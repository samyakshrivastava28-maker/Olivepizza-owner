import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import apiApp from './src/app.ts';
import { DataRetentionJob } from './src/jobs/DataRetentionJob.ts';
import './src/services/DataLifecycleService.ts';
import './src/services/notification/NotificationQueueService.ts';
import './src/jobs/WeeklyReportJob.ts';
import { kb } from './src/services/KnowledgeBaseService.ts';
import { pineconeService } from './src/services/ai/PineconeService.ts';
import { storageAnalyzer } from './src/services/storageAnalyzer.service.ts';
import { validateEnvironmentVariables } from './src/config/validator.ts';
import { initScheduler } from './src/scripts/scheduler.ts';
import { initPostgres, pgPool } from './src/config/postgres.ts';
import { adminDb } from './src/config/firebase.ts';
import { FirestoreListener } from './src/listeners/firestore.listener.ts';
import { initKeepAlive } from './src/scripts/keepAlive.ts';
import { webSocketServer } from './src/services/websocket/WebSocketServer.ts';
import { AIHeartbeatJob } from './src/jobs/AIHeartbeatJob.ts';
import { AiHealthMonitorService } from './src/services/AiHealthMonitorService.ts';
import { SheetsSyncWorker } from './src/services/reports/SheetsSyncWorker.ts';

dotenv.config();

// Crash Resilience
process.on('uncaughtException', (err: any) => {
  console.error('[Process] Uncaught Exception:', err?.message || err);
});

process.on('unhandledRejection', (reason: any) => {
  console.warn('[Process] Unhandled Rejection:', reason?.message || reason);
});

validateEnvironmentVariables();

const app = express();
const PORT = process.env.PORT || 5000;

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/ready', async (req, res) => {
  const checks: Record<string, string> = {
    server: 'ready',
    firebase: 'checking',
    postgres: 'checking'
  };

  try {
    await adminDb.collection('settings').limit(1).get();
    checks.firebase = 'healthy';
  } catch (e: any) {
    checks.firebase = 'degraded';
  }

  try {
    await pgPool.query('SELECT 1');
    checks.postgres = 'healthy';
  } catch (e: any) {
    checks.postgres = 'degraded';
  }

  const isReady = checks.server === 'ready';
  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ready' : 'not_ready',
    checks,
    timestamp: new Date().toISOString()
  });
});

app.get(['/api/heartbeat', '/heartbeat'], (req, res) => {
  res.json({
    status: 'ok',
    service: 'Olive Pizza Canonical Owner Backend Service',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Initialize Storage Analyzer Cron Jobs
storageAnalyzer.startCronJobs();

app.get('/keep-alive', (req, res) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString()
  });
});

app.use('/api', apiApp);
app.use(apiApp);

// Start server on configured port (default: 5175 in dev)
const server = app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`⚡ Olive Pizza Canonical Backend Server running on http://localhost:${PORT}`);
  initKeepAlive();
  webSocketServer.attach(server);
  console.log('[WebSocketServer] Attached on path /ws');

  // Asynchronous background boots
  (async () => {
    initPostgres().catch((err: any) => console.warn('[PostgreSQL] Init warning:', err?.message));
    initScheduler();
    DataRetentionJob.schedule();
    AIHeartbeatJob.schedule();
    AiHealthMonitorService.start();
    SheetsSyncWorker.startBackgroundWorker(60000);

    kb.initialize().catch(err => console.warn('[KB] Non-fatal init error:', err.message));
    try {
      const { KnowledgeSyncService } = await import('./src/services/knowledge/KnowledgeSyncService.ts');
      KnowledgeSyncService.initializeSync();
    } catch (err: any) {
      console.warn('[KnowledgeSync] Initialization warning:', err.message);
    }

    pineconeService.getStatus().catch((err: any) => console.warn('[Pinecone] Non-fatal init error:', err.message));
    FirestoreListener.init();
  })();
});

export default app;
