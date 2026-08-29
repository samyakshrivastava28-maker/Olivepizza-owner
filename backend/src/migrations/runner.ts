import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(customPool?: any): Promise<{ applied: string[]; skipped: string[] }> {
  let dbUrl = process.env.DATABASE_URL;
  if (dbUrl && dbUrl.includes('.supabase.co')) {
    dbUrl = dbUrl.replace('db.tdjrkqmhdynbaciguyvr.supabase.co:5432', 'aws-1-ap-south-1.pooler.supabase.com:6543');
    if (!dbUrl.includes('pgbouncer=true')) {
      dbUrl += (dbUrl.includes('?') ? '&' : '?') + 'pgbouncer=true';
    }
  }

  const pool = customPool || new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  const client = await pool.connect();
  const applied: string[] = [];
  const skipped: string[] = [];

  try {
    // 1. Ensure migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        checksum VARCHAR(64)
      );
    `);

    // 2. Discover all .sql files in migrations directory
    const files = fs.readdirSync(__dirname)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const version = file.split('_')[0] || file;
      const checkRes = await client.query('SELECT version FROM schema_migrations WHERE version = $1', [version]);

      if (checkRes.rows.length > 0) {
        skipped.push(file);
        continue;
      }

      console.log(`[Migrations] Applying ${file}...`);
      const sqlContent = fs.readFileSync(path.join(__dirname, file), 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sqlContent);
        await client.query(
          'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
          [version, file]
        );
        await client.query('COMMIT');
        applied.push(file);
        console.log(`[Migrations] ✅ Successfully applied ${file}`);
      } catch (err: any) {
        await client.query('ROLLBACK');
        console.error(`[Migrations] ❌ Failed to apply ${file}:`, err.message);
        throw err;
      }
    }
  } finally {
    client.release();
    if (!customPool) {
      await pool.end();
    }
  }

  return { applied, skipped };
}