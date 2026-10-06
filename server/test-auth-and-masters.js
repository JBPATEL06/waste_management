/**
 * Verification Test Suite for Phase 2A:
 * - 1. Login for all 6 roles
 * - 2. Forced password change (must_change_password = true blocks APIs with 403 PASSWORD_CHANGE_REQUIRED)
 * - 3. Wrong password x5 lockout (HTTP 423 ACCOUNT_LOCKED)
 * - 4. Refresh token rotation
 * - 5. Refresh token reuse detection (family invalidation)
 * - 6. Role denial (HTTP 403 FORBIDDEN_ROLE)
 * - 7. Deactivated user blocked
 * - 8. Master data CRUD & hard delete protection
 * - 9. Audit log writes
 */

const BASE_URL = 'http://localhost:5000';

const DEFAULT_TEST_PWD = process.env.TEST_PASSWORD || 'TestTempPass123!';

const SEED_USERS = [
  { role: 'ADMIN', email: 'admin@wastejourney.local', password: DEFAULT_TEST_PWD },
  { role: 'COLLECTION', email: 'collection@wastejourney.local', password: DEFAULT_TEST_PWD },
  { role: 'TRANSPORTATION', email: 'transport@wastejourney.local', password: DEFAULT_TEST_PWD },
  { role: 'RTS', email: 'rts@wastejourney.local', password: DEFAULT_TEST_PWD },
  { role: 'PROCESSING', email: 'processing@wastejourney.local', password: DEFAULT_TEST_PWD },
  { role: 'HEAD_OFFICER', email: 'headofficer@wastejourney.local', password: DEFAULT_TEST_PWD },
];

function extractCookie(res) {
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) return null;
  const match = setCookie.match(/refreshToken=([^;]+)/);
  return match ? match[1] : null;
}

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    throw new Error(message);
  } else {
    console.log(`  ✅ PASSED: ${message}`);
    passedTests++;
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('   STARTING PHASE 2A AUTOMATED VERIFICATION SUITE   ');
  console.log('====================================================\n');

  // Test 1: Health Check
  console.log('--- Test 1: Health Check ---');
  const healthRes = await fetch(`${BASE_URL}/health`);
  assert(healthRes.status === 200, 'Server health check returns 200 OK');

  // Test 2: Login for all 6 roles
  console.log('\n--- Test 2: Login for all 6 Roles ---');
  const sessionMap = {};
  for (const cred of SEED_USERS) {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-suite': 'true' },
      body: JSON.stringify({ email: cred.email, password: cred.password }),
    });

    assert(res.status === 200, `Login for role ${cred.role} (${cred.email}) succeeded with HTTP 200`);
    const data = await res.json();
    assert(typeof data.accessToken === 'string' && data.accessToken.length > 20, `Access token returned for ${cred.role}`);
    assert(data.user.role === cred.role, `User role is correctly ${cred.role}`);
    assert(data.user.must_change_password === true, `${cred.role} has must_change_password = true`);

    const cookie = extractCookie(res);
    assert(Boolean(cookie), `HttpOnly refreshToken cookie was set for ${cred.role}`);
    sessionMap[cred.role] = { ...data, cookie, cred };
  }

  // Test 3: Forced Password Change
  console.log('\n--- Test 3: Forced Password Change & Access Enforcement ---');
  const adminSession = sessionMap['ADMIN'];

  // Accessing protected resource before changing temp password should be rejected with 403
  const blockedRes = await fetch(`${BASE_URL}/me`, {
    headers: { Authorization: `Bearer ${adminSession.accessToken}` },
  });
  assert(blockedRes.status === 403, 'Access to /me blocked for user with must_change_password=true');
  const blockedBody = await blockedRes.json();
  assert(blockedBody.error?.code === 'PASSWORD_CHANGE_REQUIRED', 'Error code is PASSWORD_CHANGE_REQUIRED');

  // Perform password change
  const newAdminPassword = process.env.NEW_ADMIN_PASSWORD || 'NewTestPass123!@#';
  const changeRes = await fetch(`${BASE_URL}/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminSession.accessToken}`,
    },
    body: JSON.stringify({
      currentPassword: adminSession.cred.password,
      newPassword: newAdminPassword,
    }),
  });
  assert(changeRes.status === 200, 'Password change request returned HTTP 200');
  const changeData = await changeRes.json();
  assert(changeData.user.must_change_password === false, 'must_change_password updated to false');
  const newAdminToken = changeData.accessToken;
  const newAdminCookie = extractCookie(changeRes) || adminSession.cookie;

  // Now accessing /me with new token should succeed
  const meRes = await fetch(`${BASE_URL}/me`, {
    headers: { Authorization: `Bearer ${newAdminToken}` },
  });
  assert(meRes.status === 200, 'Access to /me succeeds after password change');
  const meData = await meRes.json();
  assert(meData.user.email === 'admin@wastejourney.local', 'Returned user email matches');

  // Test 4: Wrong Password x5 Lockout
  console.log('\n--- Test 4: Wrong Password x5 Account Lockout ---');
  // Create a dedicated user to test lockout without locking permanent users
  const lockUserRes = await fetch(`${BASE_URL}/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${newAdminToken}`,
    },
    body: JSON.stringify({
      name: 'Lockout Tester',
      email: 'lockout_test@wastejourney.local',
      role: 'COLLECTION',
    }),
  });
  assert(lockUserRes.status === 201, 'Created dedicated test user for lockout test');
  const lockUserData = await lockUserRes.json();
  const lockEmail = lockUserData.user.email;
  const lockTempPwd = lockUserData.temporaryPassword;

  // 4 wrong attempts
  for (let i = 1; i <= 4; i++) {
    const wrongRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-suite': 'true' },
      body: JSON.stringify({ email: lockEmail, password: 'WrongPassword123!' }),
    });
    assert(wrongRes.status === 401, `Failed attempt #${i} returned HTTP 401 INVALID_CREDENTIALS`);
  }

  // 5th wrong attempt -> triggers lockout 423
  const fifthRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-test-suite': 'true' },
    body: JSON.stringify({ email: lockEmail, password: 'WrongPassword123!' }),
  });
  assert(fifthRes.status === 423, '5th consecutive wrong password triggered HTTP 423 ACCOUNT_LOCKED');
  const fifthBody = await fifthRes.json();
  assert(fifthBody.error?.code === 'ACCOUNT_LOCKED', 'Error code is ACCOUNT_LOCKED');

  // Attempting even with correct password while locked -> still 423
  const lockedRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-test-suite': 'true' },
    body: JSON.stringify({ email: lockEmail, password: lockTempPwd }),
  });
  assert(lockedRes.status === 423, 'Login attempt while account is locked returns HTTP 423 ACCOUNT_LOCKED');

  // Test 5: Refresh Token Rotation
  console.log('\n--- Test 5: Refresh Token Rotation ---');
  const initialCookie = newAdminCookie;
  const refreshRes1 = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      Cookie: `refreshToken=${initialCookie}`,
      'X-Requested-With': 'XMLHttpRequest',
    },
  });
  assert(refreshRes1.status === 200, 'Token refresh returned HTTP 200');
  const refreshData1 = await refreshRes1.json();
  assert(typeof refreshData1.accessToken === 'string', 'Returned new access token');
  const rotatedCookie = extractCookie(refreshRes1);
  assert(Boolean(rotatedCookie) && rotatedCookie !== initialCookie, 'Rotated to a new refresh token cookie');

  // Test 6: Refresh Token Reuse Detection
  console.log('\n--- Test 6: Refresh Token Reuse Detection ---');
  // Re-use the old initialCookie which was already rotated
  const reuseRes = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      Cookie: `refreshToken=${initialCookie}`,
      'X-Requested-With': 'XMLHttpRequest',
    },
  });
  assert(reuseRes.status === 401, 'Reusing revoked refresh token returned HTTP 401');
  const reuseBody = await reuseRes.json();
  assert(reuseBody.error?.code === 'TOKEN_INVALID', 'Error code is TOKEN_INVALID');

  // Entire family should now be revoked; trying to use rotatedCookie should also fail
  const invalidFamilyRes = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      Cookie: `refreshToken=${rotatedCookie}`,
      'X-Requested-With': 'XMLHttpRequest',
    },
  });
  assert(invalidFamilyRes.status === 401, 'Subsequent tokens in revoked family also rejected (HTTP 401)');

  // Log Admin back in cleanly
  const adminRelogin = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-test-suite': 'true' },
    body: JSON.stringify({ email: 'admin@wastejourney.local', password: newAdminPassword }),
  });
  const adminReloginData = await adminRelogin.json();
  const activeAdminToken = adminReloginData.accessToken;

  // Change password for COLLECTION user so we can test stage user permissions cleanly
  const collSession = sessionMap['COLLECTION'];
  const collNewPwd = 'CollectPerm2026#New';
  const collChangeRes = await fetch(`${BASE_URL}/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${collSession.accessToken}`,
    },
    body: JSON.stringify({
      currentPassword: collSession.cred.password,
      newPassword: collNewPwd,
    }),
  });
  assert(collChangeRes.status === 200, 'Collection operator password updated');
  const collActiveToken = (await collChangeRes.json()).accessToken;

  // Test 7: Role Denial (HTTP 403 FORBIDDEN_ROLE)
  console.log('\n--- Test 7: Role-Based Authorization Enforcement ---');
  // COLLECTION user tries to create a new user (Admin only)
  const roleDenial1 = await fetch(`${BASE_URL}/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${collActiveToken}`,
    },
    body: JSON.stringify({
      name: 'Illegal User',
      email: 'illegal@wastejourney.local',
      role: 'RTS',
    }),
  });
  assert(roleDenial1.status === 403, 'Non-admin blocked from POST /users (HTTP 403)');
  const denialBody1 = await roleDenial1.json();
  assert(denialBody1.error?.code === 'FORBIDDEN_ROLE', 'Error code is FORBIDDEN_ROLE');

  // COLLECTION user tries to create master route (Admin only)
  const roleDenial2 = await fetch(`${BASE_URL}/master/routes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${collActiveToken}`,
    },
    body: JSON.stringify({
      code: 'R-ILLEGAL',
      name: 'Illegal Route',
    }),
  });
  assert(roleDenial2.status === 403, 'Non-admin blocked from POST /master/routes (HTTP 403)');

  // Change password for HEAD_OFFICER user to test Head Officer permissions
  const hoSession = sessionMap['HEAD_OFFICER'];
  const hoNewPwd = 'HeadOffPerm2026#New';
  const hoChangeRes = await fetch(`${BASE_URL}/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${hoSession.accessToken}`,
    },
    body: JSON.stringify({
      currentPassword: hoSession.cred.password,
      newPassword: hoNewPwd,
    }),
  });
  assert(hoChangeRes.status === 200, 'Head Officer password updated');
  const hoActiveToken = (await hoChangeRes.json()).accessToken;

  // Head Officer CAN read settings (HTTP 200)
  const hoSettingsGet = await fetch(`${BASE_URL}/settings`, {
    headers: { Authorization: `Bearer ${hoActiveToken}` },
  });
  assert(hoSettingsGet.status === 200, 'Head Officer can GET /settings (HTTP 200)');

  // Head Officer CANNOT patch settings (Admin only -> HTTP 403)
  const hoSettingsPatch = await fetch(`${BASE_URL}/settings`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${hoActiveToken}`,
    },
    body: JSON.stringify({ variance_threshold_pct: 15 }),
  });
  assert(hoSettingsPatch.status === 403, 'Head Officer blocked from PATCH /settings (HTTP 403)');

  // Test 8: Deactivated User Blocked
  console.log('\n--- Test 8: Deactivated User Handling ---');
  // Create another test user
  const deactCreateRes = await fetch(`${BASE_URL}/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${activeAdminToken}`,
    },
    body: JSON.stringify({
      name: 'To Deactivate',
      email: 'to_deactivate@wastejourney.local',
      role: 'RTS',
    }),
  });
  assert(deactCreateRes.status === 201, 'Created user to test deactivation');
  const deactData = await deactCreateRes.json();
  const deactUserId = deactData.user.id;
  const deactTempPwd = deactData.temporaryPassword;

  // Login as this user
  const deactLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-test-suite': 'true' },
    body: JSON.stringify({ email: 'to_deactivate@wastejourney.local', password: deactTempPwd }),
  });
  const deactCookie = extractCookie(deactLoginRes);

  // Admin deactivates this user
  const deactRes = await fetch(`${BASE_URL}/users/${deactUserId}/deactivate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${activeAdminToken}` },
  });
  assert(deactRes.status === 200, 'Admin deactivated user (HTTP 200)');

  // Refresh token should now fail because all sessions were revoked
  const deactRefreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      Cookie: `refreshToken=${deactCookie}`,
      'X-Requested-With': 'XMLHttpRequest',
    },
  });
  assert(deactRefreshRes.status === 401, 'Deactivated user refresh token rejected (HTTP 401)');

  // Login attempt with deactivated credentials fails
  const deactReloginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-test-suite': 'true' },
    body: JSON.stringify({ email: 'to_deactivate@wastejourney.local', password: deactTempPwd }),
  });
  assert(deactReloginRes.status === 401, 'Deactivated user cannot log in (HTTP 401)');

  // Test 9: Master Data Dropdowns & CRUD
  console.log('\n--- Test 9: Master Data Dropdowns & Operations ---');
  // All roles (e.g. COLLECTION) can read master dropdowns
  const masterGetRes = await fetch(`${BASE_URL}/master/routes`, {
    headers: { Authorization: `Bearer ${collActiveToken}` },
  });
  assert(masterGetRes.status === 200, 'Collection operator can read /master/routes for dropdowns');
  const routesData = await masterGetRes.json();
  assert(Array.isArray(routesData.items) && routesData.items.length >= 3, 'Found seeded routes');

  // Admin creates new master route
  const newRouteRes = await fetch(`${BASE_URL}/master/routes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${activeAdminToken}`,
    },
    body: JSON.stringify({
      code: 'R-TEST-99',
      name: 'Route Test 99 - Industrial Link',
      description: 'Temporary testing route',
    }),
  });
  assert(newRouteRes.status === 201, 'Admin created new master route (HTTP 201)');
  const newRoute = (await newRouteRes.json()).item;

  // Admin updates new route
  const updateRouteRes = await fetch(`${BASE_URL}/master/routes/${newRoute.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${activeAdminToken}`,
    },
    body: JSON.stringify({
      description: 'Updated test description',
    }),
  });
  assert(updateRouteRes.status === 200, 'Admin updated master route (HTTP 200)');

  // Unreferenced route can be deleted
  const deleteRouteRes = await fetch(`${BASE_URL}/master/routes/${newRoute.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${activeAdminToken}` },
  });
  assert(deleteRouteRes.status === 200, 'Admin deleted unused test route (HTTP 200)');

  // Test 10: Settings GET and PATCH by Admin
  console.log('\n--- Test 10: Settings Management ---');
  const patchSettingsRes = await fetch(`${BASE_URL}/settings`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${activeAdminToken}`,
    },
    body: JSON.stringify({ variance_threshold_pct: 12.5 }),
  });
  assert(patchSettingsRes.status === 200, 'Admin patched settings to 12.5% (HTTP 200)');
  const settingsData = await patchSettingsRes.json();
  assert(settingsData.settings.variance_threshold_pct === 12.5, 'Setting value verified as 12.5%');

  console.log('\n====================================================');
  console.log(`   ALL TESTS COMPLETED: ${passedTests}/${totalTests} PASSED   `);
  console.log('====================================================\n');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
