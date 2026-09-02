import cron from 'node-cron';
import { weeklyReportService } from '../lib/services/WeeklyReportService.js';
import { WeeklyReportJob } from '../jobs/WeeklyReportJob.js';
import { DataExpiryJob } from '../jobs/DataExpiryJob.js';
import { OrderTimeoutWorker } from '../services/order/OrderTimeoutWorker.js';

export function initScheduler() {
  // Initialize 10-minute unaccepted order auto-cancellation worker
  OrderTimeoutWorker.init();

  // Initialize weekly report cron (Runs every Monday at 00:05 AM)
  WeeklyReportJob.initCronJob();

  // Initialize expiry engine
  DataExpiryJob.schedule();

  // Daily cleanup of old GPS tracking data (older than 24 hours) at 3:00 AM
  cron.schedule('0 3 * * *', async () => {
    console.log('[Scheduler] Running daily location cleanup...');
    try {
      const { pgPool } = await import('../config/postgres.js');
      await pgPool.query(`
        DELETE FROM delivery_locations 
        WHERE last_updated < NOW() - INTERVAL '24 hours'
      `).catch(() => {});
      console.log('[Scheduler] Location cleanup completed.');
    } catch (error: any) {
      console.error('[Scheduler] Location cleanup error:', error.message);
    }
  });

  console.log('🗓️ [Scheduler] Automated weekly background schedulers initialized.');
}
