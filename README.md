# Waste Journey Tracking Portal ♻️

A production-style web portal to track municipal solid waste batches through their complete lifecycle:
**Collection $\rightarrow$ Transportation $\rightarrow$ RTS (Transfer) $\rightarrow$ Processing**
using unique Batch IDs (`WB-YYYY-NNNN`) and QR codes.

> **Current developer guide:** [Project structure, frontend/backend locations,
> local setup, and API workflow](docs/developer_guide.md). The guide reflects
> the current code and should be preferred over older setup notes below.

---

## 1. Prerequisites

- **Node.js**: v20.0.0 or higher (required by the backend)
- **npm**: v9.0.0 or higher
- **PostgreSQL Database**:
  - **Option A (Cloud Supabase - Recommended & Free)**: Free Supabase project using the **Session Pooler** (IPv4 enabled, port 5432 / 6543, no paid add-ons required).
  - **Option B (Local Supabase)**: Supabase CLI (`supabase`) and Docker / Docker Desktop installed.

---

## 2. Environment Setup

### Backend Environment Configuration
Create `.env` in the project root and in `server/.env`:

```env
# Database Connection (Supabase Session Pooler or Local PostgreSQL)
# Note: For passwords with special characters (#, ?, +), URL-encode them (%23, %3F, %2B)
DATABASE_URL=postgresql://postgres.<project-ref>:<encoded-password>@aws-0-<region>.pooler.supabase.com:5432/postgres

# Server Settings
PORT=5000
NODE_ENV=development

# JWT Authentication
JWT_SECRET=your_super_secret_jwt_key_at_least_32_chars_long
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_DAYS=7

# CORS & Cookies (Supports dev ports 5173 and 5174)
CORS_ORIGIN=http://localhost:5173,http://localhost:5174
COOKIE_DOMAIN=localhost
COOKIE_SECURE=false
COOKIE_SAMESITE=lax

# Live Supabase Keys (Optional / Client reference)
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
SUPABASE_JWKS_URL=https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json
```

### Frontend Environment Configuration
Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

---

## 3. Database Migration & Seeding

### Option A: Cloud Supabase Setup
1. **Apply Migration**:
   In your Supabase Dashboard, go to **SQL Editor** $\rightarrow$ **New Query**, paste the contents of [`supabase/migrations/20261006100811_init_schema.sql`](supabase/migrations/20261006100811_init_schema.sql), and click **Run**.
2. **Apply Base Seed**:
   In the SQL Editor, paste and run [`supabase/seed.sql`](supabase/seed.sql) to seed master routes, vehicles, transfer hubs, processing facilities, drivers, and default user accounts.
3. **Populate Phase 4 Demo Batches via API**:
   With the server running, execute:
   ```bash
   node server/seed-demo-data.js
   ```

### Option B: Local Supabase CLI
```bash
# Start local Supabase containers (requires Docker)
supabase start

# Apply migrations
supabase db reset

# Seed Phase 4 Demo batches
node server/seed-demo-data.js
```

---

## 4. Running the Application

### 1. Start the Backend Server
```bash
cd server
npm install
npm run dev
```
*API will be available at:* `http://localhost:5000`  
*Health Check:* `http://localhost:5000/health`

### 2. Start the Frontend Client
```bash
cd frontend
npm install
npm run dev
```
*Web Portal will be available at:* `http://localhost:5173`

---

## 5. Seed Users & Credentials

Default test user accounts for local demonstration (passwords configured via environment variables or initial reset):

| Role | Email | Password | Access Scope |
|---|---|---|---|
| **Admin** | `admin@wastejourney.local` | `<Set in .env or generated>` | Full access: Master Data, User Mgmt, Batch Creation, Audit Log, Settings, Export |
| **Collection** | `collection@wastejourney.local` | `<Set in .env or generated>` | Collection queue, log/correct collection entries, personal history |
| **Transportation** | `transport@wastejourney.local` | `<Set in .env or generated>` | Transit queue, log departure/arrival, journey corrections, personal history |
| **RTS** | `rts@wastejourney.local` | `<Set in .env or generated>` | Transfer station queue, weighbridge reception, variance tracking, personal history |
| **Processing** | `processing@wastejourney.local` | `<Set in .env or generated>` | Processing queue, treatment facility entries, final status assignment, personal history |
| **Head Officer** | `headofficer@wastejourney.local` | `<Set in .env or generated>` | Management overview (read-only): Dashboard, Batch List, Batch Details, Audit Log, Export |

*Public tracking does not require credentials:* Access via `/track/:batchCode` or scan any batch QR code.

---

## 6. Running Automated Tests

Run the backend integration test suites to verify system integrity:

```bash
cd server

# 1. Phase 2A: Authentication, Token Rotation, Lockout, and Master Data
node test-auth-and-masters.js

# 2. Phase 2B: Core Business Logic, Stage Locking, Corrections, and Audits
node test-core-business-logic.js

# 3. Phase 2C: Public Whitelist, Dashboard KPIs, Streaming Exports, and Audit Log
node test-phase-2c.js
```

---

## 7. Demo Data States (Phase 4)

The demo seeder script ([`server/seed-demo-data.js`](server/seed-demo-data.js)) creates 4 distinct batches through business logic APIs:

1. **Batch 1** (`CREATED`): Created with 4 stage assignees; awaiting collection pickup.
2. **Batch 2** (`COLLECTED`): Collection manifest recorded with weight, route, vehicle, driver.
3. **Batch 3** (`IN_TRANSIT`): Dispatched by transportation driver; destination RTS set; arrival timestamp pending.
4. **Batch 4** (`COMPLETED`):
   - Full 4-stage lifecycle completed.
   - Includes a **Transportation Correction** (v1 $\rightarrow$ v2 `SUPERSEDED`, recording weighbridge arrival).
   - Includes an **RTS Entry with Variance Flag** (-16.00% difference exceeding the 10% threshold, `is_flagged = true`).
   - Final processing completed with recovery status.

---

## 8. Mobile Responsiveness

The stage entry forms ([`src/pages/stage/StageEntryForm.jsx`](frontend/src/pages/stage/StageEntryForm.jsx)) are optimized for field operators using handheld devices (down to 360px viewport):
- Single-column form layout (`grid-cols-1`) on mobile viewports.
- Touch targets $\ge 40$px for all buttons and inputs.
- Mobile drawer navigation with responsive hamburger menu.
- Stacked action buttons (`flex-col-reverse`) prioritizing primary submission on mobile screens.
