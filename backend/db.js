// ==========================================
// StageSync: Database Connection Pool
// Module: Core Database Layer (Local & Cloud/Neon Compatible)
// ==========================================

const { Pool } = require('pg');

let poolConfig = {};

if (process.env.DATABASE_URL) {
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
  };
} else {
  poolConfig = {
    user: process.env.DB_USER || 'ajayyadav',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'postgres',
    password: process.env.DB_PASSWORD || '',
    port: parseInt(process.env.DB_PORT || '5432'),
    max: 20,
    idleTimeoutMillis: 30000,
  };
}

const pool = new Pool(poolConfig);

// Helper function to execute queries inside the stagesync schema
async function query(text, params) {
  const client = await pool.connect();
  try {
    await client.query('SET search_path TO stagesync, public;');
    const res = await client.query(text, params);
    return res;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  query,
};
