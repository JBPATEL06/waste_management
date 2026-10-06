/**
 * Integration Test Suite for Phase 2B: Core Business Logic
 * - 1. Login and password reset for test actors
 * - 2. Head Officer write denial (403 FORBIDDEN_ROLE)
 * - 3. Admin batch creation with sequence code WB-YYYY-NNNN & 4 assignees
 * - 4. Stage lock enforcement (prior stage missing, Transportation arrival missing)
 * - 5. Assignment enforcement (403 NOT_ASSIGNED)
 * - 6. Stage 1: Collection submission & batch status evolution to COLLECTED
 * - 7. Stage entry exists check (409 ENTRY_EXISTS)
 * - 8. Stage 2: Transportation submission, arrival lock on RTS, and correction versioning (v1 -> v2)
 * - 9. Stage 3: RTS entry with variance computation & threshold flagging
 * - 10. Stage 4: Processing submission & batch status evolution to COMPLETED
 * - 11. Admin delete block (DELETE_BLOCKED when later stage active) & reverse-order soft delete
 * - 12. Status re-derivation on deletion
 * - 13. Operator personal history (GET /me/history)
 * - 14. Batch QR data endpoint (GET /batches/:id/qr)
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

async function loginAndInitUser(email, tempPassword, newPassword) {
  const envPwd = process.env.TEST_PASSWORD || process.env.DEMO_USER_PASSWORD;
  const candidatePasswords = [envPwd, tempPassword, newPassword].filter(Boolean);

  let loginData = null;
  let activePassword = tempPassword;

  for (const pwd of candidatePasswords) {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-suite': 'true' },
      body: JSON.stringify({ email, password: pwd }),
    });
    if (res.status === 200) {
      loginData = await res.json();
      activePassword = pwd;
      break;
    }
  }

  if (!loginData) {
    throw new Error(`Cannot login for ${email} with any candidate password`);
  }

  if (loginData.user.must_change_password) {
    const changeRes = await fetch(`${BASE_URL}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginData.accessToken}`,
      },
      body: JSON.stringify({
        currentPassword: activePassword,
        newPassword,
      }),
    });
    if (changeRes.status !== 200) {
      throw new Error(`Failed to change password for ${email}`);
    }
    return (await changeRes.json()).accessToken;
  }
  return loginData.accessToken;
}

async function runCoreTests() {
  console.log('========================================================');
  console.log('   STARTING PHASE 2B CORE BUSINESS LOGIC TEST SUITE     ');
  console.log('========================================================\n');

  // 1. Authenticate all roles
  console.log('--- Step 1: Initializing Authenticated Sessions ---');
  const tempPwd = process.env.TEST_TEMP_PASSWORD || 'TestTempPass123!';
  const permPwd = process.env.TEST_PERM_PASSWORD || 'TestPermPass123!@#';
  const adminToken = await loginAndInitUser('admin@wastejourney.local', tempPwd, permPwd);
  const collToken = await loginAndInitUser('collection@wastejourney.local', tempPwd, permPwd);
  const transToken = await loginAndInitUser('transport@wastejourney.local', tempPwd, permPwd);
  const rtsToken = await loginAndInitUser('rts@wastejourney.local', tempPwd, permPwd);
  const procToken = await loginAndInitUser('processing@wastejourney.local', tempPwd, permPwd);
  const hoToken = await loginAndInitUser('headofficer@wastejourney.local', tempPwd, permPwd);

  assert(Boolean(adminToken && collToken && transToken && rtsToken && procToken && hoToken), 'All 6 actor tokens ready');

  // Fetch users & masters for payload setup
  const usersRes = await fetch(`${BASE_URL}/users`, { headers: { Authorization: `Bearer ${adminToken}` } });
  const allUsers = (await usersRes.json()).users;
  const userMap = {};
  for (const u of allUsers) {
    userMap[u.role] = u.id;
  }

  const routesRes = await fetch(`${BASE_URL}/master/routes`, { headers: { Authorization: `Bearer ${adminToken}` } });
  const routes = (await routesRes.json()).items;
  const routeId = routes[0].id;

  const vehRes = await fetch(`${BASE_URL}/master/vehicles`, { headers: { Authorization: `Bearer ${adminToken}` } });
  const vehicles = (await vehRes.json()).items;
  const vehicleId = vehicles[0].id;

  const rtsRes = await fetch(`${BASE_URL}/master/rts_locations`, { headers: { Authorization: `Bearer ${adminToken}` } });
  const rtsLocations = (await rtsRes.json()).items;
  const rtsLocationId = rtsLocations[0].id;

  const facRes = await fetch(`${BASE_URL}/master/processing_facilities`, { headers: { Authorization: `Bearer ${adminToken}` } });
  const facilities = (await facRes.json()).items;
  const facilityId = facilities[0].id;

  const catRes = await fetch(`${BASE_URL}/master/waste_categories`, { headers: { Authorization: `Bearer ${adminToken}` } });
  const wasteCategories = (await catRes.json()).items;
  const wasteCategoryId = wasteCategories[0].id;

  const procTypeRes = await fetch(`${BASE_URL}/master/process_types`, { headers: { Authorization: `Bearer ${adminToken}` } });
  const processTypes = (await procTypeRes.json()).items;
  const processTypeId = processTypes[0].id;

  const driversRes = await fetch(`${BASE_URL}/master/drivers`, { headers: { Authorization: `Bearer ${adminToken}` } });
  const drivers = (await driversRes.json()).items;
  const driverId = drivers[0].id;

  // 2. Head Officer Write Denial
  console.log('\n--- Step 2: Head Officer Write Denial ---');
  const hoBatchCreate = await fetch(`${BASE_URL}/batches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hoToken}` },
    body: JSON.stringify({
      batch_date: '2026-10-06',
      waste_type: 'WET',
      quantity: 5000,
      source_area: 'Zone A',
      route_id: routeId,
      vehicle_id: vehicleId,
      assignments: [
        { stage: 'COLLECTION', user_id: userMap['COLLECTION'] },
        { stage: 'TRANSPORTATION', user_id: userMap['TRANSPORTATION'] },
        { stage: 'RTS', user_id: userMap['RTS'] },
        { stage: 'PROCESSING', user_id: userMap['PROCESSING'] },
      ],
    }),
  });
  assert(hoBatchCreate.status === 403, 'Head Officer blocked from POST /batches (HTTP 403)');
  const hoBody = await hoBatchCreate.json();
  assert(hoBody.error?.code === 'FORBIDDEN_ROLE', 'Error code is FORBIDDEN_ROLE');

  // 3. Admin Batch Creation
  console.log('\n--- Step 3: Admin Batch Creation ---');
  const batchCreateRes = await fetch(`${BASE_URL}/batches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      batch_date: '2026-10-06',
      waste_type: 'WET',
      quantity: 5000.0,
      source_area: 'City Center Market, Block B',
      route_id: routeId,
      vehicle_id: vehicleId,
      assignments: [
        { stage: 'COLLECTION', user_id: userMap['COLLECTION'] },
        { stage: 'TRANSPORTATION', user_id: userMap['TRANSPORTATION'] },
        { stage: 'RTS', user_id: userMap['RTS'] },
        { stage: 'PROCESSING', user_id: userMap['PROCESSING'] },
      ],
    }),
  });
  assert(batchCreateRes.status === 201, 'Batch created by Admin with HTTP 201');
  const batchData = await batchCreateRes.json();
  const batch = batchData.batch;
  assert(/^WB-\d{4}-\d{4}$/.test(batch.batch_code), `Batch code matches WB-YYYY-NNNN format (${batch.batch_code})`);
  assert(batch.current_status === 'CREATED', 'Initial batch current_status is CREATED');
  assert(batch.current_stage === null, 'Initial batch current_stage is null');
  assert(batchData.assignments.length === 4, '4 active stage assignments created');

  const batchId = batch.id;

  // 4. Stage Locked Errors
  console.log('\n--- Step 4: Stage Lock Enforcement ---');
  // Transportation before Collection
  const transEarlyRes = await fetch(`${BASE_URL}/batches/${batchId}/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${transToken}` },
    body: JSON.stringify({
      event_time: '2026-10-06T10:00:00Z',
      start_location: 'City Center',
      destination: 'Central RTS',
      rts_location_id: rtsLocationId,
      vehicle_id: vehicleId,
    }),
  });
  assert(transEarlyRes.status === 409, 'Transportation rejected before Collection completed (HTTP 409)');
  const transEarlyBody = await transEarlyRes.json();
  assert(transEarlyBody.error?.code === 'STAGE_LOCKED', 'Error code is STAGE_LOCKED');

  // RTS before Collection/Transportation
  const rtsEarlyRes = await fetch(`${BASE_URL}/batches/${batchId}/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${rtsToken}` },
    body: JSON.stringify({
      event_time: '2026-10-06T11:00:00Z',
      rts_location_id: rtsLocationId,
      quantity_received: 4800,
      waste_category_id: wasteCategoryId,
      handover_details: 'Officer on duty',
      next_facility_id: facilityId,
    }),
  });
  assert(rtsEarlyRes.status === 409, 'RTS rejected before previous stages (HTTP 409 STAGE_LOCKED)');

  // 5. Assignment Enforcement
  console.log('\n--- Step 5: Assignment Enforcement ---');
  // Create an unrelated second collection user
  const collUser2Res = await fetch(`${BASE_URL}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      name: 'Unassigned Collector',
      email: 'collector_other@wastejourney.local',
      role: 'COLLECTION',
    }),
  });
  const coll2Data = await collUser2Res.json();
  const collToken2 = await loginAndInitUser(coll2Data.user.email, coll2Data.temporaryPassword, 'OtherColl2026#1');

  // Unassigned operator tries to submit Collection on batchId
  const unassignedEntryRes = await fetch(`${BASE_URL}/batches/${batchId}/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${collToken2}` },
    body: JSON.stringify({
      event_time: '2026-10-06T08:00:00Z',
      collection_area: 'Zone B',
      route_id: routeId,
      vehicle_id: vehicleId,
      waste_type: 'WET',
      quantity: 5000,
      driver_id: driverId,
    }),
  });
  assert(unassignedEntryRes.status === 403, 'Unassigned user rejected from submitting entry (HTTP 403)');
  const unassignedBody = await unassignedEntryRes.json();
  assert(unassignedBody.error?.code === 'NOT_ASSIGNED', 'Error code is NOT_ASSIGNED');

  // 6. Stage 1: Collection Submission
  console.log('\n--- Step 6: Stage 1 - Collection Stage Submission ---');
  const collTime = '2026-10-06T08:00:00.000Z';
  const collEntryRes = await fetch(`${BASE_URL}/batches/${batchId}/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${collToken}` },
    body: JSON.stringify({
      event_time: collTime,
      collection_area: 'City Center Market, Block B',
      route_id: routeId,
      vehicle_id: vehicleId,
      waste_type: 'WET',
      quantity: 5000.0,
      driver_id: driverId,
      note: 'Normal morning collection complete',
    }),
  });
  assert(collEntryRes.status === 201, 'Collection entry submitted with HTTP 201');
  const collEntryData = await collEntryRes.json();
  const collEntryId = collEntryData.entry.id;
  assert(collEntryData.batch.current_status === 'COLLECTED', 'Batch status updated to COLLECTED');
  assert(collEntryData.batch.current_stage === 'COLLECTION', 'Batch stage updated to COLLECTION');
  assert(collEntryData.entry.display_location === 'City Center Market, Block B', 'display_location computed correctly');

  // Attempting second active Collection entry -> ENTRY_EXISTS
  const dupCollRes = await fetch(`${BASE_URL}/batches/${batchId}/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${collToken}` },
    body: JSON.stringify({
      event_time: '2026-10-06T08:15:00.000Z',
      collection_area: 'City Center Market',
      route_id: routeId,
      vehicle_id: vehicleId,
      waste_type: 'WET',
      quantity: 5000.0,
      driver_id: driverId,
    }),
  });
  assert(dupCollRes.status === 409, 'Second active entry for same stage rejected with HTTP 409');
  assert((await dupCollRes.json()).error?.code === 'ENTRY_EXISTS', 'Error code is ENTRY_EXISTS');

  // 7. Stage 2: Transportation Submission & Arrival Lock
  console.log('\n--- Step 7: Stage 2 - Transportation Stage Submission & Arrival Lock ---');
  const depTime = '2026-10-06T08:30:00.000Z';
  // Submit Transportation entry without arrival time
  const transEntryRes = await fetch(`${BASE_URL}/batches/${batchId}/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${transToken}` },
    body: JSON.stringify({
      event_time: depTime,
      start_location: 'City Center Market',
      destination: 'Central Transfer Station A',
      rts_location_id: rtsLocationId,
      vehicle_id: vehicleId,
      note: 'En route to RTS',
    }),
  });
  assert(transEntryRes.status === 201, 'Transportation entry (departure) created with HTTP 201');
  const transEntryData = await transEntryRes.json();
  const transEntryId = transEntryData.entry.id;
  assert(transEntryData.batch.current_status === 'IN_TRANSIT', 'Batch status updated to IN_TRANSIT');
  assert(transEntryData.batch.current_stage === 'TRANSPORTATION', 'Batch stage updated to TRANSPORTATION');

  // RTS operator attempts to submit while arrival time is missing
  const rtsBeforeArrivalRes = await fetch(`${BASE_URL}/batches/${batchId}/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${rtsToken}` },
    body: JSON.stringify({
      event_time: '2026-10-06T09:15:00.000Z',
      rts_location_id: rtsLocationId,
      quantity_received: 4800,
      waste_category_id: wasteCategoryId,
      handover_details: 'Officer Vikram Desai',
      next_facility_id: facilityId,
    }),
  });
  assert(rtsBeforeArrivalRes.status === 409, 'RTS blocked while Transportation arrival time is missing (HTTP 409)');
  assert((await rtsBeforeArrivalRes.json()).error?.code === 'STAGE_LOCKED', 'Error code is STAGE_LOCKED');

  // 8. Correction Flow: Transportation updates arrival time
  console.log('\n--- Step 8: Correction Flow (Transportation Arrival Time Added) ---');
  const arrTime = '2026-10-06T09:00:00.000Z'; // 30 minutes duration
  const transCorrectRes = await fetch(`${BASE_URL}/entries/${transEntryId}/correct`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${transToken}` },
    body: JSON.stringify({
      reason: 'Vehicle arrived at transfer station; recorded actual arrival timestamp',
      event_time: depTime,
      start_location: 'City Center Market',
      destination: 'Central Transfer Station A',
      rts_location_id: rtsLocationId,
      vehicle_id: vehicleId,
      arrival_time: arrTime,
      note: 'Trip completed in 30 minutes without incident',
    }),
  });
  assert(transCorrectRes.status === 200, 'Transportation correction submitted with HTTP 200');
  const transCorrectData = await transCorrectRes.json();
  const updatedTransEntry = transCorrectData.entry;
  assert(updatedTransEntry.version_no === 2, 'Version incremented to 2');
  assert(updatedTransEntry.supersedes_id === transEntryId, 'supersedes_id points to original entry v1');
  assert(transCorrectData.detail.duration_minutes === 30, 'duration_minutes generated as 30 minutes');

  // 9. Stage 3: RTS Entry & Variance Calculation
  console.log('\n--- Step 9: Stage 3 - RTS Entry & Variance Calculation ---');
  // Collected quantity was 5000 kg. If RTS receives 4200 kg:
  // Variance = ((4200 - 5000) / 5000) * 100 = -16.00%
  // Since abs(-16.00) > 10% threshold, it MUST be flagged!
  const rtsTime = '2026-10-06T09:15:00.000Z';
  const rtsEntryRes = await fetch(`${BASE_URL}/batches/${batchId}/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${rtsToken}` },
    body: JSON.stringify({
      event_time: rtsTime,
      rts_location_id: rtsLocationId,
      quantity_received: 4200.0,
      waste_category_id: wasteCategoryId,
      handover_details: 'Unloaded at Bay 3, handover to Facility Transport',
      next_facility_id: facilityId,
      note: 'Moisture drain observed during transit',
    }),
  });
  assert(rtsEntryRes.status === 201, 'RTS entry created with HTTP 201');
  const rtsEntryData = await rtsEntryRes.json();
  const rtsEntryId = rtsEntryData.entry.id;
  assert(rtsEntryData.batch.current_status === 'AT_RTS', 'Batch status updated to AT_RTS');
  assert(rtsEntryData.batch.current_stage === 'RTS', 'Batch stage updated to RTS');
  assert(Number(rtsEntryData.detail.variance_pct) === -16.0, `Variance calculated as -16.00% (${rtsEntryData.detail.variance_pct})`);
  assert(rtsEntryData.detail.is_flagged === true, 'Variance threshold exceeded: is_flagged is TRUE');

  // 10. Stage 4: Processing Entry & Batch Completion
  console.log('\n--- Step 10: Stage 4 - Processing Entry & Batch Completion ---');
  const procTime = '2026-10-06T10:00:00.000Z';
  const procEntryRes = await fetch(`${BASE_URL}/batches/${batchId}/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${procToken}` },
    body: JSON.stringify({
      event_time: procTime,
      facility_id: facilityId,
      process_type_id: processTypeId,
      quantity: 4150.0,
      final_status: 'PROCESSED',
      note: 'Digester feeding started',
    }),
  });
  assert(procEntryRes.status === 201, 'Processing entry created with HTTP 201');
  const procEntryData = await procEntryRes.json();
  const procEntryId = procEntryData.entry.id;
  assert(procEntryData.batch.current_status === 'COMPLETED', 'Batch status updated to COMPLETED');
  assert(procEntryData.batch.current_stage === 'PROCESSING', 'Batch stage updated to PROCESSING');

  // 11. Admin Delete Block & Reverse-Order Delete
  console.log('\n--- Step 11: Admin Delete Block & Reverse-Order Delete ---');
  // Attempt to delete COLLECTION entry while later stages exist -> DELETE_BLOCKED
  const delBlockedColl = await fetch(`${BASE_URL}/entries/${collEntryId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ reason: 'Attempting invalid out-of-order delete' }),
  });
  assert(delBlockedColl.status === 409, 'Deleting earlier stage while later stages exist is blocked (HTTP 409)');
  assert((await delBlockedColl.json()).error?.code === 'DELETE_BLOCKED', 'Error code is DELETE_BLOCKED');

  // Attempt to delete RTS entry while Processing entry exists -> DELETE_BLOCKED
  const delBlockedRts = await fetch(`${BASE_URL}/entries/${rtsEntryId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ reason: 'Attempting out-of-order RTS delete' }),
  });
  assert(delBlockedRts.status === 409, 'Deleting RTS while Processing exists is blocked (HTTP 409 DELETE_BLOCKED)');

  // Now delete in correct reverse order: delete PROCESSING entry first!
  const delProcRes = await fetch(`${BASE_URL}/entries/${procEntryId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ reason: 'Re-opening batch for facility re-weighing' }),
  });
  assert(delProcRes.status === 200, 'Processing entry deleted successfully (HTTP 200)');
  const delProcData = await delProcRes.json();
  assert(delProcData.batch.current_status === 'AT_RTS', 'Batch status re-derived back to AT_RTS');
  assert(delProcData.batch.current_stage === 'RTS', 'Batch stage re-derived back to RTS');

  // Delete RTS entry next
  const delRtsRes = await fetch(`${BASE_URL}/entries/${rtsEntryId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ reason: 'Re-weighing RTS manifest' }),
  });
  assert(delRtsRes.status === 200, 'RTS entry deleted successfully (HTTP 200)');
  const delRtsData = await delRtsRes.json();
  assert(delRtsData.batch.current_status === 'IN_TRANSIT', 'Batch status re-derived back to IN_TRANSIT');
  assert(delRtsData.batch.current_stage === 'TRANSPORTATION', 'Batch stage re-derived back to TRANSPORTATION');

  // 12. Operator History (GET /me/history)
  console.log('\n--- Step 12: Operator History (/me/history) ---');
  const myHistRes = await fetch(`${BASE_URL}/me/history`, {
    headers: { Authorization: `Bearer ${collToken}` },
  });
  assert(myHistRes.status === 200, 'Operator history retrieved with HTTP 200');
  const histData = await myHistRes.json();
  assert(histData.entries.length >= 1, 'Operator sees submitted entries across batches');
  assert(histData.entries[0].stage === 'COLLECTION', 'Entry stage is COLLECTION');

  // 13. QR Data Endpoint (GET /batches/:id/qr)
  console.log('\n--- Step 13: Batch QR Endpoint (/batches/:id/qr) ---');
  const qrRes = await fetch(`${BASE_URL}/batches/${batchId}/qr`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(qrRes.status === 200, 'QR data retrieved with HTTP 200');
  const qrData = await qrRes.json();
  assert(qrData.batch_code === batch.batch_code, 'QR data contains correct batch_code');
  assert(qrData.track_url.includes(`/track/${batch.batch_code}`), 'QR track_url properly formatted');

  console.log('\n========================================================');
  console.log(`   ALL PHASE 2B TESTS COMPLETED: ${passedTests}/${totalTests} PASSED   `);
  console.log('========================================================\n');
}

runCoreTests().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
