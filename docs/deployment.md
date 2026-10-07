# Production Deployment Guide: Waste Journey Tracking Portal

This document outlines the complete deployment procedure for hosting the **Municipal Solid Waste Custody Tracking Portal** on **Vercel** with **Supabase Cloud PostgreSQL**.

---

## 1. Architecture Overview

```
                      +------------------------------------------+
                      |               USER BROWSER               |
                      +------------------------------------------+
                                           |
                                           | HTTPS (Single Origin)
                                           v
    +-------------------------------------------------------------------------+
    |                     VERCEL PROJECT 1: FRONTEND                          |
    |  - Root Directory: `frontend`                                           |
    |  - Framework: Vite / React SPA (SPA fallback: `/(.*)` -> `/index.html`) |
    |  - Vercel Rewrites Proxy: `/api/:path*` -> Backend Vercel URL          |
    +-------------------------------------------------------------------------+
                                           |
                                           | Serverless Rewrite
                                           v
    +-------------------------------------------------------------------------+
    |                     VERCEL PROJECT 2: BACKEND                           |
    |  - Root Directory: `server`                                             |
    |  - Framework: Express (Node.js 20+ Fluid Compute)                       |
    |  - Trust Proxy: `app.set('trust proxy', 1)`                             |
    |  - Session: HttpOnly, Secure, SameSite=None (production defaults)       |
    +-------------------------------------------------------------------------+
                                           |
                                           | Port 6543 (Transaction Pooler)
                                           | SSL rejectUnauthorized: false
                                           v
    +-------------------------------------------------------------------------+
    |                   SUPABASE CLOUD POSTGRESQL (AWS RDS)                   |
    |  - Port 6543 (Supavisor Transaction Pooler)                             |
    |  - 17-Table Relational Schema with strict audit triggers                |
    +-------------------------------------------------------------------------+
```

### Why this architecture?
1. **Zero CORS Issues**: The browser only ever talks to the frontend domain (`https://waste-journey.vercel.app`).
2. **First-Party Cookies**: Refresh token cookies (`Path=/api/auth`) are issued and presented on the same domain without third-party tracking restrictions.
3. **Stateless Scalability**: The backend uses stateless JWTs and transaction-mode pooling, allowing Vercel serverless functions to scale without exceeding database connection quotas.

---

## 2. Vercel Project Configurations

You will create **two separate Vercel projects** from the same GitHub repository.

### Project 1: Backend (`waste-journey-backend`)

| Setting | Value |
|---|---|
| **Project Name** | `waste-journey-backend` |
| **Framework Preset** | `Express` (or `Other`) |
| **Root Directory** | `server` |
| **Build Command** | Leave empty (default) |
| **Output Directory** | Leave empty (default) |
| **Install Command** | `npm install --omit=dev` |
| **Node.js Version** | `20.x` |

#### Backend Environment Variables

| Variable | Value / Format | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres` | Supabase **Transaction Pooler** (Port 6543) |
| `NODE_ENV` | `production` | Enables production security & logging |
| `PORT` | `5000` | Port default |
| `JWT_SECRET` | 32+ character random secret string | Sign/verify HS256 JWT access tokens |
| `JWT_EXPIRES_IN` | `15m` | Access token lifespan |
| `REFRESH_TOKEN_EXPIRES_DAYS` | `7` | Refresh token lifespan in database |
| `FRONTEND_URL` | `https://waste-journey-frontend.vercel.app` | Allowed CORS origin |
| `COOKIE_SECURE` | `true` | Restricts cookies to HTTPS |
| `COOKIE_SAMESITE` | `none` (production default) | Cross-origin refresh cookies require HTTPS; set explicitly only when overriding the default |
| `DB_SSL_REJECT_UNAUTHORIZED` | `false` | Required for Supabase transaction pooler |
| `DB_POOL_MAX` | Leave unset for Vercel default `1` | Optional per-function-instance PostgreSQL pool size; not a global cap |
| `ALLOW_TEST_BYPASS` | `false` | Disables test header bypass in production |

---

### Project 2: Frontend (`waste-journey-frontend`)

| Setting | Value |
|---|---|
| **Project Name** | `waste-journey-frontend` |
| **Framework Preset** | `Vite` |
| **Root Directory** | `frontend` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install` |
| **Node.js Version** | `20.x` |

#### Frontend Environment Variables

| Variable | Value | Description |
|---|---|---|
| `VITE_API_URL` | `/api` | Relative base URL routed to proxy rewrite |
| `VITE_PUBLIC_URL` | `https://waste-journey-frontend.vercel.app` | Public origin used for QR codes and tracking URLs |

---

## 3. Step-by-Step Deployment Order

### Step A: Verify / Push Database Migrations
Verify that your Supabase Cloud project has applied the schema:
```bash
# Using Supabase CLI:
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```
*Alternatively*: Paste the contents of `supabase/migrations/20261006100811_init_schema.sql` into the **Supabase Dashboard SQL Editor** and execute.

### Step B: Deploy Backend Project
1. In Vercel, import the repository.
2. Select **Root Directory**: `server`.
3. Set the Environment Variables listed in Section 2 (Backend).
4. Deploy the backend project.
5. Note the assigned deployment URL (e.g., `https://waste-journey-backend.vercel.app`).
6. Test backend health:
   ```bash
   curl -i https://waste-journey-backend.vercel.app/health
   # Expected response: {"ok":true}
   ```

### Step C: Update Frontend Proxy Rewrite
In `frontend/vercel.json`, replace `BACKEND_URL_PLACEHOLDER` with your live backend hostname:
```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://waste-journey-backend.vercel.app/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### Step D: Deploy Frontend Project
1. In Vercel, import the repository as a new project.
2. Select **Root Directory**: `frontend`.
3. Set Environment Variables:
   - `VITE_API_URL=/api`
   - `VITE_PUBLIC_URL=https://waste-journey-frontend.vercel.app`
4. Deploy the frontend project.

### Step E: Seed Production Roles & Master Data
Run the idempotent production user seeder against your cloud database:
```bash
DATABASE_URL="postgresql://postgres.[REF]:[PASS]@aws-0-[REGION].pooler.supabase.com:6543/postgres" \
node scripts/seed-production-users.js
```
- Creates the 6 official role users with cryptographically secure random passwords and `must_change_password = true`.
- Passwords are written ONLY to the local git-ignored file `docs/prod_credentials.local.md`.
- Verifies reference process types, waste categories, and threshold settings.

### Step F: Run Smoke Test Validation
Validate the entire live stack through the frontend `/api` proxy:
```bash
SMOKE_ADMIN_PASSWORD="<InitialPasswordFromLocalDoc>" \
node scripts/smoke-test.js https://waste-journey-frontend.vercel.app WB-2026-0012
```

---

## 4. Rollback Procedures

### Frontend Rollback
1. Open Vercel Dashboard $\rightarrow$ **waste-journey-frontend** $\rightarrow$ **Deployments**.
2. Select the previous stable deployment.
3. Click the three dots menu ($\dots$) and choose **Instant Rollback** / **Promote to Production**.
4. The DNS switch takes effect within seconds.

### Backend Rollback
1. Open Vercel Dashboard $\rightarrow$ **waste-journey-backend** $\rightarrow$ **Deployments**.
2. Select the previous stable deployment.
3. Click **Promote to Production**.

### Database Rollback
- Never drop production tables or truncate live batches.
- If a bad column migration was applied, create and test a non-destructive forward migration that drops the unused column or relaxes constraints.

---

## 5. Troubleshooting Matrix

| Issue / Symptom | Probable Cause | Resolution |
|---|---|---|
| **Cold start latency (1–2s)** | Serverless instance initialization on first wake | Normal behavior for Vercel Fluid Compute. Pool connection timeout is 5s and idle timeout is 10s. On Vercel the default pool maximum is 1 per function instance. |
| **Cookie not saved on login** | Cookie security/SameSite configuration or frontend/backend origin mismatch | Ensure frontend is accessed over HTTPS. Production defaults are `COOKIE_SECURE=true` and `COOKIE_SAMESITE=none`; explicit environment values override them. |
| **502 Bad Gateway on `/api/*`** | Frontend proxy target is down, wrong URL, or crashed | Verify `destination` in `frontend/vercel.json` matches the backend Vercel URL. Check Vercel backend Function logs. |
| **PostgreSQL Connection Limit Exceeded** (`max clients reached`) | Too many simultaneous Vercel instances/connections, an excessive `DB_POOL_MAX`, or direct database connections | Vercel defaults to `max: 1` per function instance in `server/src/db/index.js`. Remove an unnecessarily high `DB_POOL_MAX`; use the database provider's pooler and check its total connection budget. Each serverless instance has its own pool, so per-instance values multiply under concurrency. |
| **CORS error in browser console** | Browser calling backend directly rather than via `/api` | Ensure frontend code uses relative path `/api` (handled by `client.js`). Verify `FRONTEND_URL` in backend env matches frontend domain. |
| **Database SSL Error: `SELF_SIGNED_CERT_IN_CHAIN`** | Node.js rejecting Supavisor transaction pooler certificate | Set `DB_SSL_REJECT_UNAUTHORIZED=false` in backend environment variables. |
| **Test header bypass active** | `ALLOW_TEST_BYPASS` set to true in production | Ensure `ALLOW_TEST_BYPASS` is absent or set to `false`. Rate limiter strictly ignores test headers when `NODE_ENV=production`. |
