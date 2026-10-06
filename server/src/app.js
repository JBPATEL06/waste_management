import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config/env.js';
import { pool } from './db/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import auditLogRoutes from './routes/auditLogRoutes.js';
import authRoutes from './routes/authRoutes.js';
import batchRoutes from './routes/batchRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import entryRoutes from './routes/entryRoutes.js';
import exportRoutes from './routes/exportRoutes.js';
import masterRoutes from './routes/masterRoutes.js';
import meRoutes from './routes/meRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import userRoutes from './routes/userRoutes.js';
import { AppError, ErrorCodes } from './utils/errors.js';

const app = express();

// Trust proxy for secure cookies and accurate client IP behind Vercel edge/load balancer
app.set('trust proxy', 1);

// Security HTTP headers
app.use(helmet());

// Strict CORS configuration
const allowedOrigins = [
  config.FRONTEND_URL,
  ...(config.CORS_ORIGIN ? config.CORS_ORIGIN.split(',') : []),
]
  .filter(Boolean)
  .map((s) => s.trim().replace(/\/$/, ''));

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server) or matching origin
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// Body and Cookie Parsers
app.use(express.json());
app.use(cookieParser());

// General rate limiter
app.use('/api', apiLimiter);

// Health check endpoint (verifies DB connectivity via SELECT 1, leaks no sensitive info)
const healthHandler = async (req, res) => {
  try {
    await pool.query('SELECT 1;');
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(503).json({ ok: false });
  }
};
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// Route Mounts (Support both /api/... and direct mounts for seamless flexibility)
app.use('/auth', authRoutes);
app.use('/api/auth', authRoutes);

app.use('/me', meRoutes);
app.use('/api/me', meRoutes);

app.use('/users', userRoutes);
app.use('/api/users', userRoutes);

app.use('/master', masterRoutes);
app.use('/api/master', masterRoutes);

app.use('/settings', settingsRoutes);
app.use('/api/settings', settingsRoutes);

app.use('/batches', batchRoutes);
app.use('/api/batches', batchRoutes);

app.use('/entries', entryRoutes);
app.use('/api/entries', entryRoutes);

app.use('/public', publicRoutes);
app.use('/api/public', publicRoutes);

app.use('/dashboard', dashboardRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use('/export', exportRoutes);
app.use('/api/export', exportRoutes);

app.use('/audit', auditLogRoutes);
app.use('/api/audit', auditLogRoutes);

// Fallback 404 handler for undefined endpoints
app.use((req, res, next) => {
  next(new AppError(404, ErrorCodes.NOT_FOUND, `Route not found: ${req.method} ${req.originalUrl}`));
});

// Global Error Handler
app.use(errorHandler);

export default app;

