import pg from 'pg';
import { config } from '../config/env.js';

export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
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

