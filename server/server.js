import app from './src/app.js';
import { config } from './src/config/env.js';
import { pool } from './src/db/index.js';

async function startServer() {
  try {
    // Test database connection
    const client = await pool.connect();
    const res = await client.query('SELECT current_database(), current_user;');
    client.release();
    console.log(`✅ Database connected: ${res.rows[0].current_database} as ${res.rows[0].current_user}`);

    const server = app.listen(config.PORT, () => {
      console.log(`🚀 Server listening on port ${config.PORT} [${config.NODE_ENV}]`);
      console.log(`🔗 API Base: http://localhost:${config.PORT}`);
    });

    const shutdown = async (signal) => {
      console.log(`\n🛑 Received ${signal}, closing server gracefully...`);
      server.close(async () => {
        console.log('HTTP server closed.');
        try {
          await pool.end();
          console.log('Database pool drained.');
          process.exit(0);
        } catch (err) {
          console.error('Error closing database pool:', err);
          process.exit(1);
        }
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

startServer();

