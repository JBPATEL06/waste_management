/**
 * Test Suite for Phase 2C:
 * - 1. Public Tracking Whitelist & Forbidden Fields Assertion
 * - 2. Dashboard vs Batch List Consistency (Kpis and sums matching)
 * - 3. Dashboard breakdowns, pending, recent, and operator queue
 * - 4. Export CSV & XLSX row counts and streaming
 * - 5. Audit Log API permissions, filtering, and pagination
 */

const BASE_URL = 'http://localhost:5000';

let totalTests = 0;
let passedTests = 0;

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

async function loginActor(email, password, fallbackPassword = null) {
  let res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-test-suite': 'true' },
    body: JSON.stringify({ email, password }),
  });
  if (res.status !== 200 && fallbackPassword) {
    res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-suite': 'true' },
      body: JSON.stringify({ email, password: fallbackPassword }),
    });
  }
  const data = await res.json();
  if (data.user?.must_change_password) {
    const changeRes = await fetch(`${BASE_URL}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data.accessToken}`,
      },
      body: JSON.stringify({
        currentPassword: password,
        newPassword: 'PermAuth2026#Valid',
      }),
    });
    return (await changeRes.json()).accessToken;
  }
  return data.accessToken;
}

async function runPhase2CTests() {
  console.log('========================================================');
  console.log('   STARTING PHASE 2C REMAINING BACKEND TEST SUITE       ');
  console.log('========================================================\n');

  // 1. Authenticate actors
  console.log('--- Step 1: Authenticating Actors ---');
  const adminToken = await loginActor('admin@wastejourney.local', 'AdminTemp2026!', 'PermAuth2026#Valid');
  const hoToken = await loginActor('headofficer@wastejourney.local', 'HeadOffTemp2026!', 'PermAuth2026#Valid');
  const collToken = await loginActor('collection@wastejourney.local', 'CollectTemp2026!', 'PermAuth2026#Valid');
  assert(Boolean(adminToken && hoToken && collToken), 'Actors authenticated successfully');

  // Seed 2 sample batches via Admin for data consistency testing
  console.log('\n--- Step 2: Seeding Test Batches ---');
  const routes = (await (await fetch(`${BASE_URL}/master/routes`, { headers: { Authorization: `Bearer ${adminToken}` } })).json()).items;
  const vehicles = (await (await fetch(`${BASE_URL}/master/vehicles`, { headers: { Authorization: `Bearer ${adminToken}` } })).json()).items;
  const users = (await (await fetch(`${BASE_URL}/users`, { headers: { Authorization: `Bearer ${adminToken}` } })).json()).users;
  const userMap = {};
  for (const u of users) userMap[u.role] = u.id;

  const createBatch1Res = await fetch(`${BASE_URL}/batches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      batch_date: '2026-10-06',
      waste_type: 'WET',
      quantity: 3500,
      source_area: 'Market Sector 1',
      route_id: routes[0].id,
      vehicle_id: vehicles[0].id,
      assignments: {
        collection_user_id: userMap['COLLECTION'],
        transportation_user_id: userMap['TRANSPORTATION'],
        rts_user_id: userMap['RTS'],
        processing_user_id: userMap['PROCESSING'],
      },
    }),
  });
  assert(createBatch1Res.status === 201, 'Seeded batch 1 created');
  const b1 = (await createBatch1Res.json()).batch;

  const createBatch2Res = await fetch(`${BASE_URL}/batches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      batch_date: '2026-10-06',
      waste_type: 'DRY',
      quantity: 4200,
      source_area: 'Industrial Sector 4',
      route_id: routes[1].id,
      vehicle_id: vehicles[1].id,
      assignments: {
        collection_user_id: userMap['COLLECTION'],
        transportation_user_id: userMap['TRANSPORTATION'],
        rts_user_id: userMap['RTS'],
        processing_user_id: userMap['PROCESSING'],
      },
    }),
  });
  assert(createBatch2Res.status === 201, 'Seeded batch 2 created');
  const b2 = (await createBatch2Res.json()).batch;

  // Submit Collection entry on batch 1
  const drivers = (await (await fetch(`${BASE_URL}/master/drivers`, { headers: { Authorization: `Bearer ${adminToken}` } })).json()).items;
  await fetch(`${BASE_URL}/batches/${b1.id}/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${collToken}` },
    body: JSON.stringify({
      event_time: '2026-10-06T08:00:00.000Z',
      collection_area: 'Market Sector 1',
      route_id: routes[0].id,
      vehicle_id: vehicles[0].id,
      waste_type: 'WET',
      quantity: 3500,
      driver_id: drivers[0].id,
      note: 'Morning market collection',
    }),
  });

  // 3. Public Tracking Whitelist Verification
  console.log('\n--- Step 3: Public Tracking Whitelist & Security Assertion ---');
  const publicRes = await fetch(`${BASE_URL}/public/track/${b1.batch_code}`);
  assert(publicRes.status === 200, 'Public tracking returned HTTP 200');
  const pubData = await publicRes.json();

  // Assert Whitelisted fields present
  assert(pubData.batch_code === b1.batch_code, 'Whitelisted batch_code is present');
  assert(pubData.waste_type === 'WET', 'Whitelisted waste_type is present');
  assert(pubData.quantity === 3500, 'Whitelisted quantity is present');
  assert(pubData.source_area === 'Market Sector 1', 'Whitelisted source_area is present');
  assert(pubData.current_status === 'COLLECTED', 'Whitelisted current_status is present');
  assert(Array.isArray(pubData.timeline) && pubData.timeline.length === 1, 'Timeline array is present');
  assert(pubData.timeline[0].stage === 'COLLECTION', 'Timeline contains stage name');
  assert(pubData.timeline[0].display_location === 'Market Sector 1', 'Timeline contains display_location');

  // Assert Restricted fields strictly ABSENT (never exposed publicly)
  const forbiddenKeys = [
    'driver', 'driver_id', 'driver_name', 'driverName',
    'vehicle_number', 'vehicle_id', 'vehicleNumber',
    'user_id', 'user_name', 'userName', 'created_by', 'creator_name', 'operator_name',
    'note', 'notes', 'handover_details', 'handoverDetails',
    'assignments', 'history', 'supersedes_id', 'delete_reason',
  ];

  for (const key of forbiddenKeys) {
    assert(pubData[key] === undefined, `Batch level strictly excludes restricted field '${key}'`);
    if (pubData.timeline[0]) {
      assert(pubData.timeline[0][key] === undefined, `Timeline level strictly excludes restricted field '${key}'`);
    }
  }

  // Unknown batch code returns 404
  const unknownPublicRes = await fetch(`${BASE_URL}/public/track/WB-9999-9999`);
  assert(unknownPublicRes.status === 404, 'Unknown batch code returns HTTP 404 NOT_FOUND');

  // 4. Dashboard vs Batch List Consistency
  console.log('\n--- Step 4: Dashboard vs Batch List Consistency ---');
  const batchListRes = await fetch(`${BASE_URL}/batches?limit=100`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const batchListData = await batchListRes.json();
  const allBatches = batchListData.batches;

  const summaryRes = await fetch(`${BASE_URL}/dashboard/summary`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(summaryRes.status === 200, 'GET /dashboard/summary returned HTTP 200');
  const summary = await summaryRes.json();

  // Strict match assertions
  assert(summary.kpis.total === batchListData.total, `Dashboard total (${summary.kpis.total}) matches batch list total (${batchListData.total})`);
  const collectedCount = allBatches.filter((b) => b.current_status === 'COLLECTED').length;
  assert(summary.kpis.collected === collectedCount, `Dashboard collected count (${summary.kpis.collected}) matches actual (${collectedCount})`);
  const createdCount = allBatches.filter((b) => b.current_status === 'CREATED').length;
  assert(summary.kpis.created === createdCount, `Dashboard created count (${summary.kpis.created}) matches actual (${createdCount})`);
  assert(summary.funnel.collected_kg === 3500, `Funnel collected_kg matches collection entries (${summary.funnel.collected_kg} kg)`);

  // Head Officer can access dashboard summary
  const hoSummaryRes = await fetch(`${BASE_URL}/dashboard/summary`, {
    headers: { Authorization: `Bearer ${hoToken}` },
  });
  assert(hoSummaryRes.status === 200, 'Head Officer can access /dashboard/summary (HTTP 200)');

  // 5. Breakdowns, Pending, Recent & Queue
  console.log('\n--- Step 5: Breakdowns, Pending, Recent & Operator Queue ---');
  const breakdownsRes = await fetch(`${BASE_URL}/dashboard/breakdowns`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(breakdownsRes.status === 200, 'GET /dashboard/breakdowns returned HTTP 200');
  const breakdowns = await breakdownsRes.json();
  assert(Array.isArray(breakdowns.by_waste_type), 'Breakdowns by waste type returned');
  assert(Array.isArray(breakdowns.by_route), 'Breakdowns by route returned');
  assert(Array.isArray(breakdowns.by_vehicle), 'Breakdowns by vehicle returned');

  const pendingRes = await fetch(`${BASE_URL}/dashboard/pending`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(pendingRes.status === 200, 'GET /dashboard/pending returned HTTP 200');
  const pendingData = await pendingRes.json();
  assert(Array.isArray(pendingData.pending_per_stage_per_user), 'Pending work per operator returned');

  const recentRes = await fetch(`${BASE_URL}/dashboard/recent`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(recentRes.status === 200, 'GET /dashboard/recent returned HTTP 200');
  const recentData = await recentRes.json();
  assert(Array.isArray(recentData.recent_updates), 'Recent updates returned');

  // Stage operator queue
  const queueRes = await fetch(`${BASE_URL}/dashboard/queue`, {
    headers: { Authorization: `Bearer ${collToken}` },
  });
  assert(queueRes.status === 200, 'GET /dashboard/queue returned HTTP 200 for Collection operator');
  const queueData = await queueRes.json();
  assert(typeof queueData.counts?.ready_count === 'number', 'Queue ready_count returned');
  assert(typeof queueData.counts?.submitted_count === 'number', 'Queue submitted_count returned');

  // 6. Export Streaming & Formats
  console.log('\n--- Step 6: Export Streaming (CSV & XLSX) ---');
  // Export Batches CSV
  const csvBatchesRes = await fetch(`${BASE_URL}/export/batches?format=csv`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(csvBatchesRes.status === 200, 'Export Batches CSV returned HTTP 200');
  assert(csvBatchesRes.headers.get('content-type')?.includes('text/csv'), 'Content-Type is text/csv');
  const csvText = await csvBatchesRes.text();
  const csvLines = csvText.trim().split('\n');
  assert(csvLines.length >= 3, `CSV contains header + data rows (found ${csvLines.length} lines)`);
  assert(csvLines[0].includes('Batch ID'), 'CSV contains header column Batch ID');

  // Export Batches XLSX
  const xlsxBatchesRes = await fetch(`${BASE_URL}/export/batches?format=xlsx`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(xlsxBatchesRes.status === 200, 'Export Batches XLSX returned HTTP 200');
  assert(
    xlsxBatchesRes.headers.get('content-type')?.includes('spreadsheetml'),
    'Content-Type is Excel spreadsheetml'
  );
  const xlsxBuffer = await xlsxBatchesRes.arrayBuffer();
  assert(xlsxBuffer.byteLength > 1000, `Excel file binary generated (> 1000 bytes: ${xlsxBuffer.byteLength})`);

  // Export Stage-records CSV
  const csvStageRes = await fetch(`${BASE_URL}/export/stage-records?format=csv`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(csvStageRes.status === 200, 'Export Stage-Records CSV returned HTTP 200');

  // Export Full-history CSV
  const csvHistRes = await fetch(`${BASE_URL}/export/full-history?format=csv`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(csvHistRes.status === 200, 'Export Full-History CSV returned HTTP 200');

  // Export Current-status CSV
  const csvStatusRes = await fetch(`${BASE_URL}/export/current-status?format=csv`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(csvStatusRes.status === 200, 'Export Current-Status CSV returned HTTP 200');

  // Head Officer has access to export
  const hoExportRes = await fetch(`${BASE_URL}/export/batches?format=csv`, {
    headers: { Authorization: `Bearer ${hoToken}` },
  });
  assert(hoExportRes.status === 200, 'Head Officer can download exports (HTTP 200)');

  // Stage operator blocked from export
  const collExportRes = await fetch(`${BASE_URL}/export/batches?format=csv`, {
    headers: { Authorization: `Bearer ${collToken}` },
  });
  assert(collExportRes.status === 403, 'Stage operator blocked from export (HTTP 403 FORBIDDEN_ROLE)');

  // 7. Audit Log API
  console.log('\n--- Step 7: Audit Log API & Permissions ---');
  const auditRes = await fetch(`${BASE_URL}/audit?limit=20`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(auditRes.status === 200, 'Admin can GET /audit (HTTP 200)');
  const auditData = await auditRes.json();
  assert(Array.isArray(auditData.entries) && auditData.entries.length > 0, 'Audit log entries returned');
  assert(auditData.entries[0].action !== undefined, 'Audit entries have action type');

  // Filter audit log by action
  const auditFilterRes = await fetch(`${BASE_URL}/audit?action=BATCH_CREATE`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(auditFilterRes.status === 200, 'Audit log filtered by action returned HTTP 200');
  const auditFilterData = await auditFilterRes.json();
  const allBatchCreate = auditFilterData.entries.every((e) => e.action === 'BATCH_CREATE');
  assert(allBatchCreate, 'All returned audit entries have action = BATCH_CREATE');

  // Head Officer can read audit log
  const hoAuditRes = await fetch(`${BASE_URL}/audit`, {
    headers: { Authorization: `Bearer ${hoToken}` },
  });
  assert(hoAuditRes.status === 200, 'Head Officer can read /audit (HTTP 200)');

  // Stage operator blocked from audit log
  const collAuditRes = await fetch(`${BASE_URL}/audit`, {
    headers: { Authorization: `Bearer ${collToken}` },
  });
  assert(collAuditRes.status === 403, 'Stage operator blocked from /audit (HTTP 403 FORBIDDEN_ROLE)');

  console.log('\n========================================================');
  console.log(`   ALL PHASE 2C TESTS COMPLETED: ${passedTests}/${totalTests} PASSED   `);
  console.log('========================================================\n');
}

runPhase2CTests().catch((err) => {
  console.error('Phase 2C test execution failed:', err);
  process.exit(1);
});

