import express from 'express';
import dotenv from 'dotenv';
import apiApp from './app';
import { DataRetentionJob } from './jobs/DataRetentionJob';
import './services/DataLifecycleService';
import './services/notification/NotificationQueueService';
import './jobs/WeeklyReportJob';
import { kb } from './services/KnowledgeBaseService';
import { pineconeService } from './services/ai/PineconeService';
import { storageAnalyzer } from './services/storageAnalyzer.service';
import { validateEnvironmentVariables } from './config/validator';
import { initScheduler } from './scripts/scheduler';
import { initPostgres } from './config/postgres';
import { FirestoreListener } from './listeners/firestore.listener';
import { initKeepAlive } from './scripts/keepAlive';
import { webSocketServer } from './services/websocket/WebSocketServer';

dotenv.config();

// Crash Resilience
process.on('uncaughtException', (err: any) => {
  console.error('[Owner Backend] Uncaught Exception:', err?.message || err);
});

process.on('unhandledRejection', (reason: any) => {
  console.warn('[Owner Backend] Unhandled Rejection:', reason?.message || reason);
});

validateEnvironmentVariables();

const app = express();
const PORT = process.env.PORT || 5000;

// Health & Heartbeat
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Olive Pizza Standalone Owner Backend',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/keep-alive', (req, res) => {
  res.json({ status: 'alive', timestamp: new Date().toISOString() });
});

// Mount full API application
app.use('/api', apiApp);
app.use(apiApp);

// Initialize background schedulers, Postgres & Knowledge services
async function startServer() {
  await initPostgres().catch((err: any) => console.warn('[PostgreSQL] Init warning:', err?.message));
  initScheduler();
  DataRetentionJob.schedule();
  storageAnalyzer.startCronJobs();
  FirestoreListener.init();

  kb.initialize().catch((err: any) => console.warn('[KB] Non-fatal init error:', err?.message));

  try {
    const { KnowledgeSyncService } = await import('./services/knowledge/KnowledgeSyncService');
    KnowledgeSyncService.initializeSync();
  } catch (err: any) {
    console.warn('[KnowledgeSync] Warning:', err?.message);
  }

  pineconeService.getStatus().catch((err: any) => console.warn('[Pinecone] Warning:', err?.message));

  const server = app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🍕 Olive Pizza Standalone Full Owner Backend running on http://localhost:${PORT}`);
    initKeepAlive();
    webSocketServer.attach(server);
    console.log('[WebSocketServer] Attached on path /ws');
  });
}

startServer().catch(console.error);
