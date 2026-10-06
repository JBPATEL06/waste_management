import rateLimit from 'express-rate-limit';
import { config } from '../config/env.js';

export const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // max 10 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    if (config.NODE_ENV === 'test') return true;
    if (config.NODE_ENV !== 'production' && config.ALLOW_TEST_BYPASS === true) {
      return req.headers['x-test-suite'] === 'true';
    }
    return false;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many login attempts. Please wait a minute before trying again.',
      },
    });
  },
});

export const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please wait a minute before trying again.',
      },
    });
  },
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please slow down.',
      },
    });
  },
});
