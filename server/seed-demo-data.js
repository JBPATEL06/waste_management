/**
 * Script to seed Phase 4 demo data through real API calls:
 * 4 batches at distinct stages:
 * - 1. Created (Created stage only, no entries)
 * - 2. Collected (Collection entry submitted)
 * - 3. In Transit (arrival pending) (Collection + Transportation departure, no arrival)
 * - 4. Completed (Collection + Transportation + Correction with arrival + RTS variance-flagged + Processing completed)
 */

const BASE_URL = 'http://localhost:5000';

async function loginUser(email, password = process.env.DEMO_USER_PASSWORD || process.env.TEST_PASSWORD || 'DevPassword123!') {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-test-suite': 'true' },
    body: JSON.stringify({ email, password }),
  });
  if (res.status !== 200) {
    throw new Error(`Failed to log in ${email}: HTTP ${res.status}`);
  }
  const data = await res.json();
  return { token: data.accessToken, user: data.user };
}

async function getMasterData(adminToken) {
  const [routesRes, vehiclesRes, rtsRes, facilitiesRes, procTypesRes, wasteCatRes, driversRes] = await Promise.all([
    fetch(`${BASE_URL}/master/routes`, { headers: { Authorization: `Bearer ${adminToken}` } }),
    fetch(`${BASE_URL}/master/vehicles`, { headers: { Authorization: `Bearer ${adminToken}` } }),
    fetch(`${BASE_URL}/master/rts-locations`, { headers: { Authorization: `Bearer ${adminToken}` } }),
    fetch(`${BASE_URL}/master/processing-facilities`, { headers: { Authorization: `Bearer ${adminToken}` } }),
    fetch(`${BASE_URL}/master/process-types`, { headers: { Authorization: `Bearer ${adminToken}` } }),
    fetch(`${BASE_URL}/master/waste-categories`, { headers: { Authorization: `Bearer ${adminToken}` } }),
    fetch(`${BASE_URL}/master/drivers`, { headers: { Authorization: `Bearer ${adminToken}` } }),
  ]);

  const routes = (await routesRes.json()).items;
  const vehicles = (await vehiclesRes.json()).items;
  const rtsLocations = (await rtsRes.json()).items;
  const facilities = (await facilitiesRes.json()).items;
  const processTypes = (await procTypesRes.json()).items;
  const wasteCategories = (await wasteCatRes.json()).items;
  const drivers = (await driversRes.json()).items;

  return {
    routes,
    vehicles,
    rtsLocations,
    facilities,
    processTypes,
    wasteCategories,
    drivers,
  };
}

async function runDemoSeed() {
  console.log('====================================================');
  console.log('       SEEDING PHASE 4 DEMO DATA VIA REAL API       ');
  console.log('====================================================\n');

  // 1. Authenticate actors
  console.log('1. Authenticating actors...');
  const admin = await loginUser('admin@wastejourney.local');
  const coll = await loginUser('collection@wastejourney.local');
  const trans = await loginUser('transport@wastejourney.local');
  const rts = await loginUser('rts@wastejourney.local');
  const proc = await loginUser('processing@wastejourney.local');
  console.log('✅ All 5 operators authenticated.\n');

  const adminToken = admin.token;
  const collToken = coll.token;
  const transToken = trans.token;
  const rtsToken = rts.token;
  const procToken = proc.token;

  // 2. Fetch master lookups
  console.log('2. Fetching master reference data...');
  const master = await getMasterData(adminToken);
  console.log(`✅ Loaded ${master.routes.length} routes, ${master.vehicles.length} vehicles, ${master.rtsLocations.length} RTS locations, ${master.facilities.length} facilities.\n`);

  const assignments = [
    { stage: 'COLLECTION', user_id: coll.user.id },
    { stage: 'TRANSPORTATION', user_id: trans.user.id },
    { stage: 'RTS', user_id: rts.user.id },
    { stage: 'PROCESSING', user_id: proc.user.id },
  ];

  const now = new Date();
  const timeOffset = (minutesAgo) => new Date(now.getTime() - minutesAgo * 60 * 1000).toISOString();
  const todayDate = now.toISOString().split('T')[0];

  // --------------------------------------------------------------------------
  // BATCH 1: CREATED (No stage entries yet)
  // --------------------------------------------------------------------------
  console.log('----------------------------------------------------');
  console.log('3. Creating Batch 1 (Stage: CREATED)...');
  const batch1Res = await fetch(`${BASE_URL}/batches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      batch_date: todayDate,
      waste_type: 'WET',
      quantity: 1250.00,
      source_area: 'Sector 14 Residential Ward A',
      route_id: master.routes[0].id,
      vehicle_id: master.vehicles[0].id,
      assignments,
    }),
  });
  const batch1 = (await batch1Res.json()).batch;
  console.log(`✅ Batch 1 Created: Code=${batch1.batch_code}, Status=${batch1.current_status}`);

  // --------------------------------------------------------------------------
  // BATCH 2: COLLECTED (Collection entry submitted)
  // --------------------------------------------------------------------------
  console.log('\n----------------------------------------------------');
  console.log('4. Creating Batch 2 (Stage: COLLECTED)...');
  const batch2Res = await fetch(`${BASE_URL}/batches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      batch_date: todayDate,
      waste_type: 'DRY',
      quantity: 2400.00,
      source_area: 'Commercial Hub Market Yard B',
      route_id: master.routes[1 % master.routes.length].id,
      vehicle_id: master.vehicles[1 % master.vehicles.length].id,
      assignments,
    }),
  });
  const batch2 = (await batch2Res.json()).batch;

  // Add Collection entry
  const coll2Res = await fetch(`${BASE_URL}/batches/${batch2.id}/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${collToken}` },
    body: JSON.stringify({
      stage: 'COLLECTION',
      event_time: timeOffset(120),
      collection_area: 'Commercial Hub Market Yard B',
      route_id: master.routes[1 % master.routes.length].id,
      vehicle_id: master.vehicles[1 % master.vehicles.length].id,
      waste_type: 'DRY',
      quantity: 2380.00,
      driver_id: master.drivers[0].id,
      note: 'Primary pickup completed and weighed at yard.',
    }),
  });
  const coll2Data = await coll2Res.json();
  console.log(`✅ Batch 2: Collection entry logged. Status=${coll2Data.batch?.current_status || 'COLLECTED'}`);

  // --------------------------------------------------------------------------
  // BATCH 3: IN TRANSIT (Arrival Pending)
  // --------------------------------------------------------------------------
  console.log('\n----------------------------------------------------');
  console.log('5. Creating Batch 3 (Stage: IN_TRANSIT, Arrival Pending)...');
  const batch3Res = await fetch(`${BASE_URL}/batches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      batch_date: todayDate,
      waste_type: 'WET',
      quantity: 3500.00,
      source_area: 'Outer Ring Industrial Cluster C',
      route_id: master.routes[2 % master.routes.length].id,
      vehicle_id: master.vehicles[2 % master.vehicles.length].id,
      assignments,
    }),
  });
  const batch3 = (await batch3Res.json()).batch;

  // Collection entry
  await fetch(`${BASE_URL}/batches/${batch3.id}/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${collToken}` },
    body: JSON.stringify({
      stage: 'COLLECTION',
      event_time: timeOffset(90),
      collection_area: 'Outer Ring Industrial Cluster C',
      route_id: master.routes[2 % master.routes.length].id,
      vehicle_id: master.vehicles[2 % master.vehicles.length].id,
      waste_type: 'WET',
      quantity: 3520.00,
      driver_id: master.drivers[1 % master.drivers.length].id,
      note: 'Industrial wet waste loaded onto high-capacity tipper.',
    }),
  });

  // Transportation entry with arrival_time = null
  const trans3Res = await fetch(`${BASE_URL}/batches/${batch3.id}/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${transToken}` },
    body: JSON.stringify({
      stage: 'TRANSPORTATION',
      event_time: timeOffset(30),
      start_location: 'Outer Ring Industrial Cluster C',
      destination: master.rtsLocations[0].name,
      rts_location_id: master.rtsLocations[0].id,
      vehicle_id: master.vehicles[2 % master.vehicles.length].id,
      arrival_time: null, // Arrival pending!
      note: 'En route to Central RTS Hub. Traffic moving steadily.',
    }),
  });
  const trans3Data = await trans3Res.json();
  console.log(`✅ Batch 3: Transportation departure logged. Status=${trans3Data.batch?.current_status || 'IN_TRANSIT'} (Arrival Pending)`);

  // --------------------------------------------------------------------------
  // BATCH 4: COMPLETED (Includes Correction + RTS Variance Flag)
  // --------------------------------------------------------------------------
  console.log('\n----------------------------------------------------');
  console.log('6. Creating Batch 4 (Stage: COMPLETED with Correction & Variance Flag)...');
  const batch4Res = await fetch(`${BASE_URL}/batches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      batch_date: todayDate,
      waste_type: 'DRY',
      quantity: 5000.00,
      source_area: 'South District Shopping Complex D',
      route_id: master.routes[0].id,
      vehicle_id: master.vehicles[0].id,
      assignments,
    }),
  });
  const batch4 = (await batch4Res.json()).batch;

  // Collection entry
  const coll4Res = await fetch(`${BASE_URL}/batches/${batch4.id}/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${collToken}` },
    body: JSON.stringify({
      stage: 'COLLECTION',
      event_time: timeOffset(180),
      collection_area: 'South District Shopping Complex D',
      route_id: master.routes[0].id,
      vehicle_id: master.vehicles[0].id,
      waste_type: 'DRY',
      quantity: 5000.00,
      driver_id: master.drivers[0].id,
      note: 'Mall cardboard and plastic dry recyclables collected.',
    }),
  });
  if (!coll4Res.ok) {
    const err = await coll4Res.json();
    throw new Error(`Batch 4 Collection failed (${coll4Res.status}): ${JSON.stringify(err)}`);
  }

  // Transportation departure (v1)
  const trans4Res = await fetch(`${BASE_URL}/batches/${batch4.id}/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${transToken}` },
    body: JSON.stringify({
      stage: 'TRANSPORTATION',
      event_time: timeOffset(150),
      start_location: 'South District Shopping Complex D',
      destination: master.rtsLocations[0].name,
      rts_location_id: master.rtsLocations[0].id,
      vehicle_id: master.vehicles[0].id,
      arrival_time: null,
      note: 'Departed pickup area.',
    }),
  });
  if (!trans4Res.ok) {
    const err = await trans4Res.json();
    throw new Error(`Batch 4 Transportation failed (${trans4Res.status}): ${JSON.stringify(err)}`);
  }
  const trans4Entry = (await trans4Res.json()).entry;

  // Transportation Correction (v2) - Arrival timestamp added
  console.log('   -> Submitting Transportation correction to add arrival timestamp...');
  const corr4Res = await fetch(`${BASE_URL}/entries/${trans4Entry.id}/correct`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${transToken}` },
    body: JSON.stringify({
      reason: 'Logged confirmed weighbridge arrival timestamp at RTS',
      event_time: timeOffset(150),
      start_location: 'South District Shopping Complex D',
      destination: master.rtsLocations[0].name,
      rts_location_id: master.rtsLocations[0].id,
      vehicle_id: master.vehicles[0].id,
      arrival_time: timeOffset(110), // 40 min journey duration
      note: 'Arrival confirmed at RTS Gate 1 weighbridge.',
    }),
  });
  const corr4Data = await corr4Res.json();
  console.log(`   ✅ Correction created: version=${corr4Data.entry?.version}, supersedes_id=${corr4Data.entry?.supersedes_id ? 'Yes' : 'No'}`);

  // RTS Entry with VARIANCE > 10% (Collection weight was 5000kg, RTS received 4200kg => -16% variance)
  console.log('   -> Submitting RTS entry with -16.00% variance (Flagged)...');
  const rts4Res = await fetch(`${BASE_URL}/batches/${batch4.id}/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${rtsToken}` },
    body: JSON.stringify({
      stage: 'RTS',
      event_time: timeOffset(105),
      rts_location_id: master.rtsLocations[0].id,
      quantity_received: 4200.00, // 800 kg deficit from 5000 kg => -16.00% variance!
      waste_category_id: master.wasteCategories[1 % master.wasteCategories.length].id,
      handover_details: 'Weighed on RTS platform scale 2. Pre-sorted recyclables transferred to primary bailer.',
      next_facility_id: master.facilities[1 % master.facilities.length].id,
      note: '800kg deficit flagged due to moisture loss and manual segregation at gate.',
    }),
  });
  const rts4Data = await rts4Res.json();
  const rtsDetails = rts4Data.entry?.rts_details || {};
  console.log(`   ✅ RTS Entry logged: variance=${rtsDetails.variance_pct}%, is_flagged=${rtsDetails.is_flagged}`);

  // Processing Entry (Final Stage)
  console.log('   -> Submitting final Processing entry...');
  const proc4Res = await fetch(`${BASE_URL}/batches/${batch4.id}/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${procToken}` },
    body: JSON.stringify({
      stage: 'PROCESSING',
      event_time: timeOffset(45),
      facility_id: master.facilities[1 % master.facilities.length].id,
      process_type_id: master.processTypes[1 % master.processTypes.length].id,
      quantity: 4200.00,
      final_status: 'COMPLETED',
      note: 'High-density recyclables recovered and processed into bails.',
    }),
  });
  const proc4Data = await proc4Res.json();
  console.log(`   ✅ Processing logged: Final Status=${proc4Data.batch?.current_status || 'COMPLETED'}\n`);

  console.log('====================================================');
  console.log('        DEMO DATA SEEDING COMPLETE SUMMARY          ');
  console.log('====================================================');
  console.log(`1. Batch 1: ${batch1.batch_code} -> CREATED`);
  console.log(`2. Batch 2: ${batch2.batch_code} -> COLLECTED`);
  console.log(`3. Batch 3: ${batch3.batch_code} -> IN_TRANSIT (Arrival Pending)`);
  console.log(`4. Batch 4: ${batch4.batch_code} -> COMPLETED (Includes Correction & Variance Flag)`);
  console.log('====================================================\n');

  return {
    batch1,
    batch2,
    batch3,
    batch4,
  };
}

runDemoSeed().catch((err) => {
  console.error('❌ Demo seeding failed:', err);
  process.exit(1);
});
