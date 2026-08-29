import { pgPool } from '../config/postgres.js';
import { adminDb as db } from '../config/firebase.js';
import cron from 'node-cron';

export class DataRetentionJob {
  public static async run(): Promise<void> {
    console.log('[DataRetentionJob] Starting cleanup...');
    const client = await pgPool.connect();
    
    try {
      // 1. Notification Cleanup: Keep only a week
      await client.query(`
        DELETE FROM notification_history 
        WHERE created_at < CURRENT_DATE - INTERVAL '7 days';
      `);
      
      // 2. Clear stuck notification queue items older than 6 hours
      await client.query(`
        DELETE FROM notification_queue 
        WHERE created_at < NOW() - INTERVAL '6 hours';
      `);
      
      // 3. Heartbeat Cleanup: Remove devices offline > 7 days
      await client.query(`
        DELETE FROM device_heartbeats
        WHERE last_seen < NOW() - INTERVAL '7 days';
      `);
      
      // 4. GPS Cleanup: Delete tracking coordinates 5 mins after delivery
      await client.query(`
        DELETE FROM active_deliveries
        WHERE order_id IN (
          SELECT order_id as id FROM background_tasks 
          WHERE status IN ('delivered', 'cancelled') 
          AND updated_at < NOW() - INTERVAL '5 minutes'
        );
      `);
      
      // 5. Order Retention: Keep current and previous month only
      await client.query(`
        DELETE FROM background_tasks
        WHERE created_at < date_trunc('month', CURRENT_DATE) - INTERVAL '1 month';
      `);
      
      // Note: order_items deleted via CASCADE

      // 6. Firestore Reports & History Cleanup: Remove docs older than 2 months
      try {
        const twoMonthsAgo = Date.now() - (60 * 24 * 60 * 60 * 1000); // approx 60 days
        const batches = [];
        
        for (const collectionName of ['reports', 'monthly_reports']) {
          const snap = await db.collection(collectionName)
            .where('generatedAt', '<', twoMonthsAgo)
            .get();
            
          if (!snap.empty) {
            const batch = db.batch();
            snap.docs.forEach(doc => batch.delete(doc.ref));
            batches.push(batch.commit());
          }
        }
        await Promise.all(batches);
        console.log('[DataRetentionJob] Firestore reports & history cleaned up.');
      } catch (err) {
        console.error('[DataRetentionJob] Firestore cleanup failed:', err);
      }
      
      // 7. Navigation Telemetry Auto-Expiry Cleanup (5-minute retention after STOPPED / DELIVERED)
      try {
        const deletedPoints = await client.query(`
          DELETE FROM navigation_points 
          WHERE session_id IN (
            SELECT id FROM navigation_sessions 
            WHERE status IN ('STOPPED', 'DELIVERED') 
            AND expires_at <= NOW()
          );
        `);
        const deletedSessions = await client.query(`
          DELETE FROM navigation_sessions 
          WHERE status IN ('STOPPED', 'DELIVERED') 
          AND expires_at <= NOW();
        `);
        if ((deletedPoints.rowCount ?? 0) > 0 || (deletedSessions.rowCount ?? 0) > 0) {
          console.log(`[DataRetentionJob] Cleaned up ${deletedPoints.rowCount ?? 0} expired navigation points & ${deletedSessions.rowCount ?? 0} expired sessions.`);
        }
      } catch (navErr: any) {
        console.warn('[DataRetentionJob] Navigation telemetry cleanup warning:', navErr.message);
      }

      console.log(`[DataRetentionJob] Cleanup completed successfully.`);
    } catch (err) {
      console.error('[DataRetentionJob] Failed:', err);
    } finally {
      client.release();
    }
  }

  /**
   * Enforces 5-Minute High-Frequency GPS Telemetry Retention Rule:
   * - Deletes raw GPS breadcrumb points in `navigation_points` older than 5 minutes.
   * - Deletes ended/expired navigation sessions older than 5 minutes.
   * - Preserves `delivery_locations` (current live state per rider).
   * - Permanent business records (`orders`, `delivery_history`, `payments`) are NEVER deleted.
   */
  public static async runNavigationCleanup(): Promise<{ deletedPoints: number; deletedSessions: number }> {
    let deletedPoints = 0;
    let deletedSessions = 0;
    try {
      const client = await pgPool.connect();
      try {
        // 1. Purge all high-frequency GPS breadcrumbs older than 5 minutes
        const ptsRes = await client.query(`
          DELETE FROM navigation_points 
          WHERE created_at < NOW() - INTERVAL '5 minutes';
        `);
        deletedPoints = ptsRes.rowCount ?? 0;

        // 2. Purge expired / stopped navigation sessions older than 5 minutes
        const sessRes = await client.query(`
          DELETE FROM navigation_sessions 
          WHERE (status IN ('STOPPED', 'DELIVERED') AND (ended_at < NOW() - INTERVAL '5 minutes' OR expires_at <= NOW()))
             OR (expires_at <= NOW() - INTERVAL '5 minutes');
        `);
        deletedSessions = sessRes.rowCount ?? 0;

        if (deletedPoints > 0 || deletedSessions > 0) {
          console.log(`[DataRetentionJob] 5-min GPS retention: Purged ${deletedPoints} points and ${deletedSessions} sessions.`);
        }
      } finally {
        client.release();
      }
    } catch (e: any) {
      console.warn('[DataRetentionJob] Navigation telemetry cleanup warning:', e.message);
    }
    return { deletedPoints, deletedSessions };
  }

  public static schedule() {
    // Run daily at 2:00 AM for full retention scan
    cron.schedule('0 2 * * *', () => {
      DataRetentionJob.run();
    });

    // Run every minute to enforce 5-minute navigation telemetry expiry
    cron.schedule('* * * * *', () => {
      DataRetentionJob.runNavigationCleanup();
    });
  }
}
