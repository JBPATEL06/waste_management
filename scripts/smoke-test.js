#!/usr/bin/env node
/**
 * Production Smoke Test Runner
 *
 * Validates the live deployment end-to-end via the proxied frontend URL (or direct backend URL).
 *
 * Checks:
 *   1. GET /api/health (Database connectivity & ok: true)
 *   2. POST /api/auth/login (Admin login & httpOnly cookie issuance)
 *   3. POST /api/auth/refresh (Cookie-based token refresh)
 *   4. GET /api/me (Authenticated profile retrieval & ADMIN role validation)
 *   5. GET /api/dashboard/queue (HTTP 403 enforcement for non-officer role)
 *   6. GET /api/public/track/:batchCode (Public tracking endpoint)
 *   7. Public payload privacy audit (Confirms absence of restricted internal fields)
 *
 * Usage:
 *   node scripts/smoke-test.js <BASE_URL> [BATCH_CODE]
 *
 * Example:
 *   SMOKE_ADMIN_PASSWORD='YourPassword' node scripts/smoke-test.js https://your-frontend.vercel.app WB-2026-0012
 */

import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const dotenv = require('../server/node_modules/dotenv');

const rootEnvPath = path.resolve(process.cwd(), '.env');
const serverEnvPath = path.resolve(process.cwd(), 'server/.env');
if (fs.existsSync(rootEnvPath)) dotenv.config({ path: rootEnvPath });
else if (fs.existsSync(serverEnvPath)) dotenv.config({ path: serverEnvPath });
else dotenv.config();

const rawBaseUrl = process.argv[2] || process.env.SMOKE_BASE_URL || 'http://localhost:5000';
const argBatchCode = process.argv[3] || process.env.SMOKE_BATCH_CODE || 'WB-2026-0012';

const BASE_URL = rawBaseUrl.replace(/\/$/, '');
const adminEmail = process.env.SMOKE_ADMIN_EMAIL || 'admin@wastejourney.local';
const adminPassword =
  process.env.SMOKE_ADMIN_PASSWORD ||
  process.env.TEST_PASSWORD ||
  process.env.DEMO_USER_PASSWORD;

function buildApiUrl(path) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (BASE_URL.endsWith('/api') && cleanPath.startsWith('/api')) {
    return `${BASE_URL}${cleanPath.replace('/api', '')}`;
  }
  if (!BASE_URL.endsWith('/api') && !cleanPath.startsWith('/api')) {
    return `${BASE_URL}/api${cleanPath}`;
  }
  return `${BASE_URL}${cleanPath}`;
}

function extractCookie(res, cookieName = 'refreshToken') {
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) return null;
  const match = setCookie.match(new RegExp(`${cookieName}=([^;]+)`));
  return match ? match[1] : null;
}

let checksPassed = 0;
let totalChecks = 0;

function report(condition, checkName, detail = '') {
  totalChecks++;
  if (condition) {
    console.log(`  [PASS] ${checkName}${detail ? ` (${detail})` : ''}`);
    checksPassed++;
  } else {
    console.error(`  [FAIL] ${checkName}${detail ? ` - ${detail}` : ''}`);
  }
}

async function runSmokeTests() {
  console.log('========================================================');
  console.log('        PRODUCTION DEPLOYMENT SMOKE TEST SUITE          ');
  console.log(`  Target Origin: ${BASE_URL}`);
  console.log(`  Target Batch:  ${argBatchCode}`);
  console.log('========================================================\n');

  if (!adminPassword) {
    console.error('❌ Error: SMOKE_ADMIN_PASSWORD env variable is required for login checks.');
    process.exit(1);
  }

  let accessToken = null;
  let refreshCookie = null;

  // 1. Health check
  console.log('--- 1. Health Check (GET /api/health) ---');
  try {
    const healthUrl = buildApiUrl('/health');
    const res = await fetch(healthUrl);
    const data = await res.json().catch(() => ({}));
    report(res.status === 200 && data.ok === true, 'Health check returns HTTP 200 with { ok: true }');
  } catch (err) {
    report(false, 'Health check returns HTTP 200', err.message);
  }

  // 2. Admin Login
  console.log('\n--- 2. Admin Login (POST /api/auth/login) ---');
  try {
    const loginUrl = buildApiUrl('/auth/login');
    const res = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });

    const data = await res.json().catch(() => ({}));
    accessToken = data.accessToken;
    refreshCookie = extractCookie(res, 'refreshToken');

    report(res.status === 200, 'Login returns HTTP 200', `Status: ${res.status}`);
    report(typeof accessToken === 'string' && accessToken.length > 20, 'Access token issued in response body');
    report(data.user?.role === 'ADMIN', 'Authenticated user role is ADMIN', `Role: ${data.user?.role}`);
    report(Boolean(refreshCookie), 'HttpOnly refreshToken cookie was set');
  } catch (err) {
    report(false, 'Admin login succeeded', err.message);
  }

  // 3. Token Refresh with Cookie
  console.log('\n--- 3. Token Refresh (POST /api/auth/refresh) ---');
  if (refreshCookie) {
    try {
      const refreshUrl = buildApiUrl('/auth/refresh');
      const res = await fetch(refreshUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `refreshToken=${refreshCookie}`,
        },
      });

      const data = await res.json().catch(() => ({}));
      report(res.status === 200, 'Refresh endpoint returns HTTP 200 with valid cookie');
      report(typeof data.accessToken === 'string' && data.accessToken.length > 20, 'New rotated access token returned');
      if (data.accessToken) accessToken = data.accessToken; // Rotate to new token
    } catch (err) {
      report(false, 'Token refresh succeeded', err.message);
    }
  } else {
    report(false, 'Token refresh check skipped (no cookie received from login)');
  }

  // 4. Authenticated Profile (GET /api/me)
  console.log('\n--- 4. Authenticated Profile (GET /api/me) ---');
  if (accessToken) {
    try {
      const meUrl = buildApiUrl('/me');
      const res = await fetch(meUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const data = await res.json().catch(() => ({}));
      const profile = data.user || data;
      report(res.status === 200, 'GET /api/me returns HTTP 200');
      report(profile.email === adminEmail, 'Profile email matches authenticated user', profile.email);
    } catch (err) {
      report(false, 'GET /api/me succeeded', err.message);
    }
  } else {
    report(false, 'GET /api/me skipped (no access token)');
  }

  // 5. Role-Restricted Endpoint Block (GET /api/dashboard/queue)
  console.log('\n--- 5. RBAC Enforcement (GET /api/dashboard/queue) ---');
  if (accessToken) {
    try {
      const queueUrl = buildApiUrl('/dashboard/queue');
      const res = await fetch(queueUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const data = await res.json().catch(() => ({}));
      report(
        res.status === 403 && data.error?.code === 'FORBIDDEN_ROLE',
        'Role-restricted endpoint correctly denies ADMIN with HTTP 403 FORBIDDEN_ROLE',
        `Status: ${res.status}, Code: ${data.error?.code}`
      );
    } catch (err) {
      report(false, 'RBAC 403 enforcement check', err.message);
    }
  } else {
    report(false, 'RBAC 403 enforcement check skipped (no access token)');
  }

  // 6. Public Tracking Endpoint (GET /api/public/track/:batchCode)
  console.log(`\n--- 6. Public Tracking (GET /api/public/track/${argBatchCode}) ---`);
  let publicData = null;
  try {
    const trackUrl = buildApiUrl(`/public/track/${encodeURIComponent(argBatchCode)}`);
    const res = await fetch(trackUrl);
    publicData = await res.json().catch(() => ({}));

    report(res.status === 200, `Public tracking for '${argBatchCode}' returns HTTP 200`);
    report(
      publicData.batch_code?.toUpperCase() === argBatchCode.toUpperCase(),
      'Response matches requested batch_code',
      publicData.batch_code
    );
    report(Array.isArray(publicData.timeline), 'Public response contains timeline array');
  } catch (err) {
    report(false, `Public tracking for '${argBatchCode}'`, err.message);
  }

  // 7. Privacy & Data Leaking Check on Public Response
  console.log('\n--- 7. Public Response Privacy Audit (No Restricted Fields) ---');
  if (publicData && typeof publicData === 'object') {
    const restrictedRootFields = [
      'assignments',
      'notes',
      'created_by',
      'driver_name',
      'driver_phone',
      'vehicle_number',
      'internal_notes',
      'password_hash',
    ];

    const foundRestrictedRoot = restrictedRootFields.filter((f) => f in publicData);
    report(
      foundRestrictedRoot.length === 0,
      'Absence of internal batch fields (assignments, drivers, notes, created_by)',
      foundRestrictedRoot.length > 0 ? `Leaked: ${foundRestrictedRoot.join(', ')}` : 'Clean'
    );

    let foundRestrictedTimeline = [];
    if (Array.isArray(publicData.timeline)) {
      const restrictedTimelineFields = ['entered_by', 'driver_id', 'vehicle_id', 'variance_percent', 'user_id', 'notes'];
      for (const entry of publicData.timeline) {
        for (const field of restrictedTimelineFields) {
          if (field in entry) foundRestrictedTimeline.push(field);
        }
      }
    }

    report(
      foundRestrictedTimeline.length === 0,
      'Absence of officer/internal tracking fields in timeline entries',
      foundRestrictedTimeline.length > 0 ? `Leaked: ${foundRestrictedTimeline.join(', ')}` : 'Clean'
    );
  } else {
    report(false, 'Public privacy audit skipped (no public data returned)');
  }

  // Summary
  console.log('\n========================================================');
  console.log(`SMOKE TEST RESULTS: ${checksPassed} / ${totalChecks} PASSED`);
  if (checksPassed === totalChecks) {
    console.log('🎉 ALL PRODUCTION CHECKS PASSED!');
    console.log('========================================================\n');
    process.exit(0);
  } else {
    console.error(`❌ ${totalChecks - checksPassed} CHECKS FAILED.`);
    console.log('========================================================\n');
    process.exit(1);
  }
}

runSmokeTests();
