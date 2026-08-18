import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Test connection on startup
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('🔥 PostgreSQL Connection Error: ', err.message);
    console.error('Please ensure you have set DATABASE_URL in your .env file.');
  } else {
    console.log('✅ PostgreSQL Connected successfully.');
  }
});

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log(`Executed query in ${duration}ms:`, { text, rows: res.rowCount });
  return res;
};

export const getClient = () => {
  return pool.connect();
};

export default pool;
