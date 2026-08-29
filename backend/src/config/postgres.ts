import pkg from 'pg';
const { Pool } = pkg;
import type { PoolClient, QueryResult } from 'pg';
import dotenv from 'dotenv';
import { runMigrations } from '../migrations/runner.js';

dotenv.config();

let dbUrl = process.env.DATABASE_URL;

// Auto-fix Render IPv6 issue for Supabase (Forces IPv4 Connection Pooler)
if (dbUrl && dbUrl.includes('.supabase.co')) {
  dbUrl = dbUrl.replace('db.tdjrkqmhdynbaciguyvr.supabase.co:5432', 'aws-1-ap-south-1.pooler.supabase.com:6543');
  if (!dbUrl.includes('pgbouncer=true')) {
    dbUrl += (dbUrl.includes('?') ? '&' : '?') + 'pgbouncer=true';
  }
}

const maxConnections = parseInt(process.env.POSTGRES_POOL_MAX || '20', 10);
const idleTimeoutMillis = parseInt(process.env.POSTGRES_POOL_IDLE_TIMEOUT_MS || '30000', 10);
const connectionTimeoutMillis = parseInt(process.env.POSTGRES_POOL_CONN_TIMEOUT_MS || '10000', 10);

export const pgPool = new Pool({
  connectionString: dbUrl,
  max: maxConnections,
  idleTimeoutMillis: idleTimeoutMillis,
  connectionTimeoutMillis: connectionTimeoutMillis,
  ssl: {
    rejectUnauthorized: false
  },
  statement_timeout: 15000, // 15 seconds per statement limit
});

pgPool.on('error', (err) => {
  console.warn('[PostgreSQL Pool] Idle client connection warning (safe to ignore):', err.message);
});

/**
 * Execute parameterized query with automatic timing and error logging
 */
export async function query<T = any>(text: string, params: any[] = []): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const res = await pgPool.query<T>(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`[PostgreSQL Slow Query] ${duration}ms: ${text.substring(0, 120)}`);
    }
    return res;
  } catch (err: any) {
    console.error(`[PostgreSQL Query Error] ${err.message} | Query: ${text.substring(0, 120)}`);
    throw err;
  }
}

/**
 * Execute an atomic transaction block with automatic BEGIN, COMMIT, and ROLLBACK
 */
export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rbErr: any) {
      console.error('[PostgreSQL Transaction] Rollback error:', rbErr.message);
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Health check helper returning connectivity latency and pool metrics without exposing secrets
 */
export async function checkPostgresHealth(): Promise<{
  connected: boolean;
  latencyMs: number;
  poolStatus: { total: number; idle: number; waiting: number };
  error?: string;
}> {
  const start = Date.now();
  try {
    const res = await pgPool.query('SELECT 1 as ping');
    const latencyMs = Date.now() - start;
    return {
      connected: res.rows[0]?.ping === 1,
      latencyMs,
      poolStatus: {
        total: pgPool.totalCount,
        idle: pgPool.idleCount,
        waiting: pgPool.waitingCount,
      }
    };
  } catch (err: any) {
    return {
      connected: false,
      latencyMs: Date.now() - start,
      poolStatus: {
        total: pgPool.totalCount,
        idle: pgPool.idleCount,
        waiting: pgPool.waitingCount,
      },
      error: err.message || 'PostgreSQL ping failed',
    };
  }
}

/**
 * Graceful pool drain on process shutdown
 */
export async function closePostgresPool(): Promise<void> {
  try {
    await pgPool.end();
    console.log('[PostgreSQL] Connection pool gracefully closed.');
  } catch (err: any) {
    console.error('[PostgreSQL] Error closing pool:', err.message);
  }
}

process.on('SIGTERM', closePostgresPool);
process.on('SIGINT', closePostgresPool);

/**
 * Initialize PostgreSQL tables, migrations, and triggers
 */
export const initPostgres = async () => {
  try {
    // 1. Run repeatable version-controlled migrations
    await runMigrations();

    const client = await pgPool.connect();

    // 2. Add delivery_locations to supabase_realtime publication safely if present
    try {
      await client.query(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'delivery_locations') THEN
            IF NOT EXISTS (
              SELECT 1 FROM pg_publication_tables 
              WHERE pubname = 'supabase_realtime' AND tablename = 'delivery_locations'
            ) THEN
              ALTER PUBLICATION supabase_realtime ADD TABLE delivery_locations;
            END IF;
          END IF;
        END $$;
      `);
    } catch (e: any) {
      // Safe to ignore if not running on Supabase
    }

    // 3. PostgreSQL LISTEN / NOTIFY for instant notification queue wakeup
    try {
      await client.query(`
        CREATE OR REPLACE FUNCTION notify_notification_queue_insert()
        RETURNS trigger AS $$
        BEGIN
          PERFORM pg_notify('notification_queue_channel', NEW.id::text);
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);

      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_trigger
            WHERE tgname = 'trg_notify_notification_queue'
          ) THEN
            CREATE TRIGGER trg_notify_notification_queue
              AFTER INSERT ON notification_queue
              FOR EACH ROW EXECUTE FUNCTION notify_notification_queue_insert();
          END IF;
        END $$;
      `);
    } catch (e: any) {
      // Non-fatal if notification_queue is managed separately
    }

    client.release();
    console.log('[PostgreSQL] Standard PostgreSQL initialized successfully with connection pool.');
  } catch (error: any) {
    console.error('[PostgreSQL] Initialization error:', error.message);
  }
};