import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  // Resilience: recycle idle connections before the server drops them
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Prevent unhandled pool errors from crashing the process
pool.on('error', (err) => {
  console.error('⚠️  Unexpected DB pool error:', err.message);
});

export { pool };
