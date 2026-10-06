import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env file (supports running from repo root or server directory)
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_DAYS: z.coerce.number().default(7),
  CORS_ORIGIN: z.string().default('http://localhost:5173,http://localhost:5174'),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: z.preprocess((val) => {
    if (val === undefined || val === '') {
      return process.env.NODE_ENV === 'production';
    }
    return val === 'true' || val === true;
  }, z.boolean()).default(false),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none', 'Lax', 'Strict', 'None']).default('lax'),
  FRONTEND_URL: z.string().optional(),
  ALLOW_TEST_BYPASS: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(false),
  DB_SSL_REJECT_UNAUTHORIZED: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(false),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),
  SUPABASE_JWKS_URL: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Environment validation failed with errors:');
  for (const issue of parsed.error.issues) {
    console.error(`  - [${issue.path.join('.')}]: ${issue.message}`);
  }
  process.exit(1);
}

export const config = parsed.data;

