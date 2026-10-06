import pg from 'pg';
import { config } from '../config/env.js';

const isLocalhost =
  config.DATABASE_URL.includes('localhost') || config.DATABASE_URL.includes('127.0.0.1');

export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  ssl: isLocalhost
    ? false
    : {
        rejectUnauthorized: config.DB_SSL_REJECT_UNAUTHORIZED === true,
      },
  max: process.env.DB_POOL_MAX
    ? parseInt(process.env.DB_POOL_MAX, 10)
    : config.NODE_ENV === 'production'
    ? 10
    : 20,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

export const query = (text, params) => pool.query(text, params);

export const getClient = () => pool.connect();

export default {
  pool,
  query,
  getClient,
};

