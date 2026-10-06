import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config/env.js';
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

// Security HTTP headers
app.use(helmet());

// Strict CORS configuration
app.use(
  cors({
    origin: config.CORS_ORIGIN,
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

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

