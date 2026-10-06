import { query } from '../db/index.js';

function buildBatchFilterSql(filters, paramOffset = 0) {
  const whereClauses = [];
  const params = [];

  if (filters.status) {
    params.push(filters.status);
    whereClauses.push(`b.current_status = $${paramOffset + params.length}`);
  }

  if (filters.waste_type && filters.waste_type !== 'ALL') {
    params.push(filters.waste_type);
    whereClauses.push(`b.waste_type = $${paramOffset + params.length}`);
  }

  if (filters.route_id && filters.route_id !== 'ALL') {
    params.push(filters.route_id);
    whereClauses.push(`b.route_id = $${paramOffset + params.length}`);
  }

  if (filters.vehicle_id && filters.vehicle_id !== 'ALL') {
    params.push(filters.vehicle_id);
    whereClauses.push(`b.vehicle_id = $${paramOffset + params.length}`);
  }

  if (filters.start_date) {
    params.push(filters.start_date);
    whereClauses.push(`b.batch_date >= $${paramOffset + params.length}`);
  }

  if (filters.end_date) {
    params.push(filters.end_date);
    whereClauses.push(`b.batch_date <= $${paramOffset + params.length}`);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  return { whereSql, whereClauses, params };
}

const dashboardCache = new Map();
const CACHE_TTL_MS = 20 * 1000; // 20 seconds TTL

function getCached(key) {
  const item = dashboardCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    dashboardCache.delete(key);
    return null;
  }
  return item.data;
}

function setCached(key, data) {
  if (dashboardCache.size > 200) dashboardCache.clear();
  dashboardCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function invalidateDashboardCache() {
  dashboardCache.clear();
}

export async function getSummary(filters = {}) {
  const cacheKey = 'summary:' + JSON.stringify(filters);
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const { whereSql, params } = buildBatchFilterSql(filters);

  // 1. KPI Counts
  const kpiQuery = `
    SELECT 
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE b.current_status = 'CREATED') AS created,
      COUNT(*) FILTER (WHERE b.current_status = 'COLLECTED') AS collected,
      COUNT(*) FILTER (WHERE b.current_status = 'IN_TRANSIT') AS in_transit,
      COUNT(*) FILTER (WHERE b.current_status = 'AT_RTS') AS at_rts,
      COUNT(*) FILTER (WHERE b.current_status = 'COMPLETED') AS completed,
      COALESCE(SUM(b.quantity), 0) AS total_initial_quantity
    FROM batches b
    ${whereSql}
  `;

  // 2. Quantity Funnel
  const funnelQuery = `
    SELECT 
      COALESCE(SUM(cd.quantity), 0) AS collected_kg,
      COALESCE(SUM(rd.quantity_received), 0) AS rts_received_kg,
      COALESCE(SUM(pd.quantity), 0) AS processed_kg
    FROM batches b
    LEFT JOIN stage_entries se_c ON se_c.batch_id = b.id AND se_c.stage = 'COLLECTION' AND se_c.status = 'ACTIVE'
    LEFT JOIN collection_details cd ON cd.entry_id = se_c.id
    LEFT JOIN stage_entries se_r ON se_r.batch_id = b.id AND se_r.stage = 'RTS' AND se_r.status = 'ACTIVE'
    LEFT JOIN rts_details rd ON rd.entry_id = se_r.id
    LEFT JOIN stage_entries se_p ON se_p.batch_id = b.id AND se_p.stage = 'PROCESSING' AND se_p.status = 'ACTIVE'
    LEFT JOIN processing_details pd ON pd.entry_id = se_p.id
    ${whereSql}
  `;

  // 3. Operational Metrics
  const durationQuery = `
    SELECT COALESCE(ROUND(AVG(td.duration_minutes)), 0) AS avg_duration_minutes
    FROM batches b
    JOIN stage_entries se_t ON se_t.batch_id = b.id AND se_t.stage = 'TRANSPORTATION' AND se_t.status = 'ACTIVE'
    JOIN transportation_details td ON td.entry_id = se_t.id
    ${whereSql}
  `;

  const delayedQuery = `
    SELECT COUNT(*) AS delayed_count
    FROM batches b
    ${whereSql ? whereSql + ' AND' : 'WHERE'} b.current_status != 'COMPLETED' AND b.updated_at < now() - INTERVAL '24 hours'
  `;

  const flaggedQuery = `
    SELECT COUNT(*) AS flagged_count
    FROM batches b
    JOIN stage_entries se ON se.batch_id = b.id AND se.stage = 'RTS' AND se.status = 'ACTIVE'
    JOIN rts_details rd ON rd.entry_id = se.id
    ${whereSql ? whereSql + ' AND' : 'WHERE'} rd.is_flagged = true
  `;

  // Execute all 5 metrics queries in parallel
  const [kpiRes, funnelRes, durationRes, delayedRes, flaggedRes] = await Promise.all([
    query(kpiQuery, params),
    query(funnelQuery, params),
    query(durationQuery, params),
    query(delayedQuery, params),
    query(flaggedQuery, params),
  ]);

  const kpi = kpiRes.rows[0];
  const funnel = funnelRes.rows[0];

  const collectedKg = Number(funnel.collected_kg);
  const rtsReceivedKg = Number(funnel.rts_received_kg);
  const processedKg = Number(funnel.processed_kg);
  const netLossKg = Number((collectedKg - processedKg).toFixed(2));
  const retentionRatePct = collectedKg > 0 ? Number(((processedKg / collectedKg) * 100).toFixed(2)) : 0;
  const avgDurationMinutes = Number(durationRes.rows[0]?.avg_duration_minutes || 0);
  const delayedBatchesCount = Number(delayedRes.rows[0]?.delayed_count || 0);
  const flaggedVariancesCount = Number(flaggedRes.rows[0]?.flagged_count || 0);

  const result = {
    kpis: {
      total: Number(kpi.total),
      created: Number(kpi.created),
      collected: Number(kpi.collected),
      in_transit: Number(kpi.in_transit),
      at_rts: Number(kpi.at_rts),
      completed: Number(kpi.completed),
      total_initial_quantity: Number(kpi.total_initial_quantity),
    },
    funnel: {
      collected_kg: collectedKg,
      rts_received_kg: rtsReceivedKg,
      processed_kg: processedKg,
      net_loss_kg: netLossKg,
      retention_rate_pct: retentionRatePct,
    },
    operational: {
      avg_duration_minutes: avgDurationMinutes,
      delayed_batches_count: delayedBatchesCount,
      flagged_variances_count: flaggedVariancesCount,
    },
  };

  setCached(cacheKey, result);
  return result;
}

export async function getBreakdowns(filters = {}) {
  const cacheKey = 'breakdowns:' + JSON.stringify(filters);
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const { whereSql, params } = buildBatchFilterSql(filters);

  // Execute all 7 breakdown queries in parallel
  const [
    wasteTypeRes,
    routeRes,
    vehicleRes,
    rtsRes,
    facilityRes,
    processTypeRes,
    finalStatusRes,
  ] = await Promise.all([
    query(
      `SELECT b.waste_type AS name, COUNT(*) AS count, COALESCE(SUM(b.quantity), 0) AS quantity
       FROM batches b
       ${whereSql}
       GROUP BY b.waste_type
       ORDER BY b.waste_type ASC`,
      params
    ),
    query(
      `SELECT r.id, r.code, r.name, COUNT(b.id) AS count, COALESCE(SUM(b.quantity), 0) AS quantity
       FROM batches b
       JOIN routes r ON r.id = b.route_id
       ${whereSql}
       GROUP BY r.id, r.code, r.name
       ORDER BY count DESC`,
      params
    ),
    query(
      `SELECT v.id, v.vehicle_number, COUNT(b.id) AS count, COALESCE(SUM(b.quantity), 0) AS quantity
       FROM batches b
       JOIN vehicles v ON v.id = b.vehicle_id
       ${whereSql}
       GROUP BY v.id, v.vehicle_number
       ORDER BY count DESC`,
      params
    ),
    query(
      `SELECT rl.id, rl.name, COUNT(rd.entry_id) AS count, COALESCE(SUM(rd.quantity_received), 0) AS quantity
       FROM batches b
       JOIN stage_entries se ON se.batch_id = b.id AND se.stage = 'RTS' AND se.status = 'ACTIVE'
       JOIN rts_details rd ON rd.entry_id = se.id
       JOIN rts_locations rl ON rl.id = rd.rts_location_id
       ${whereSql}
       GROUP BY rl.id, rl.name
       ORDER BY count DESC`,
      params
    ),
    query(
      `SELECT pf.id, pf.name, COUNT(pd.entry_id) AS count, COALESCE(SUM(pd.quantity), 0) AS quantity
       FROM batches b
       JOIN stage_entries se ON se.batch_id = b.id AND se.stage = 'PROCESSING' AND se.status = 'ACTIVE'
       JOIN processing_details pd ON pd.entry_id = se.id
       JOIN processing_facilities pf ON pf.id = pd.facility_id
       ${whereSql}
       GROUP BY pf.id, pf.name
       ORDER BY count DESC`,
      params
    ),
    query(
      `SELECT pt.id, pt.name, COUNT(pd.entry_id) AS count, COALESCE(SUM(pd.quantity), 0) AS quantity
       FROM batches b
       JOIN stage_entries se ON se.batch_id = b.id AND se.stage = 'PROCESSING' AND se.status = 'ACTIVE'
       JOIN processing_details pd ON pd.entry_id = se.id
       JOIN process_types pt ON pt.id = pd.process_type_id
       ${whereSql}
       GROUP BY pt.id, pt.name
       ORDER BY count DESC`,
      params
    ),
    query(
      `SELECT pd.final_status AS name, COUNT(pd.entry_id) AS count, COALESCE(SUM(pd.quantity), 0) AS quantity
       FROM batches b
       JOIN stage_entries se ON se.batch_id = b.id AND se.stage = 'PROCESSING' AND se.status = 'ACTIVE'
       JOIN processing_details pd ON pd.entry_id = se.id
       ${whereSql}
       GROUP BY pd.final_status
       ORDER BY count DESC`,
      params
    ),
  ]);

  const result = {
    by_waste_type: wasteTypeRes.rows.map((r) => ({ ...r, count: Number(r.count), quantity: Number(r.quantity) })),
    by_route: routeRes.rows.map((r) => ({ ...r, count: Number(r.count), quantity: Number(r.quantity) })),
    by_vehicle: vehicleRes.rows.map((r) => ({ ...r, count: Number(r.count), quantity: Number(r.quantity) })),
    by_rts: rtsRes.rows.map((r) => ({ ...r, count: Number(r.count), quantity: Number(r.quantity) })),
    by_facility: facilityRes.rows.map((r) => ({ ...r, count: Number(r.count), quantity: Number(r.quantity) })),
    by_process_type: processTypeRes.rows.map((r) => ({ ...r, count: Number(r.count), quantity: Number(r.quantity) })),
    by_final_status: finalStatusRes.rows.map((r) => ({ ...r, count: Number(r.count), quantity: Number(r.quantity) })),
  };

  setCached(cacheKey, result);
  return result;
}

export async function getPending(filters = {}) {
  const cacheKey = 'pending:' + JSON.stringify(filters);
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const { whereSql, params } = buildBatchFilterSql(filters);

  const pendingQuery = `
    SELECT 
      u.id AS user_id, 
      u.name AS user_name, 
      u.role, 
      COUNT(ba.batch_id) AS pending_count
    FROM batch_assignments ba
    JOIN users u ON u.id = ba.user_id
    JOIN batches b ON b.id = ba.batch_id
    LEFT JOIN stage_entries se ON se.batch_id = ba.batch_id AND se.stage = ba.stage AND se.status = 'ACTIVE'
    ${whereSql ? whereSql + ' AND' : 'WHERE'} ba.is_active = true AND se.id IS NULL AND b.current_status != 'COMPLETED'
    GROUP BY u.id, u.name, u.role
    ORDER BY pending_count DESC
  `;

  const res = await query(pendingQuery, params);
  const result = {
    pending_per_stage_per_user: res.rows.map((r) => ({
      ...r,
      pending_count: Number(r.pending_count),
    })),
  };

  setCached(cacheKey, result);
  return result;
}

export async function getRecent(filters = {}) {
  const cacheKey = 'recent:' + JSON.stringify(filters);
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const { whereSql, params } = buildBatchFilterSql(filters);

  // Latest updates
  const updatesQuery = `
    SELECT b.id, b.batch_code, b.current_status, b.waste_type, b.quantity, b.updated_at, r.name AS route_name
    FROM batches b
    LEFT JOIN routes r ON r.id = b.route_id
    ${whereSql}
    ORDER BY b.updated_at DESC
    LIMIT 10
  `;

  // Latest corrections & deletions from audit_log
  const correctionsQuery = `
    SELECT 
      al.id, al.action, al.batch_id, al.performed_at, al.reason,
      u.name AS user_name, u.role AS user_role,
      b.batch_code
    FROM audit_log al
    JOIN users u ON u.id = al.performed_by
    LEFT JOIN batches b ON b.id = al.batch_id
    WHERE al.action IN ('ENTRY_CORRECT', 'ENTRY_ADMIN_EDIT', 'ENTRY_ADMIN_DELETE')
    ORDER BY al.performed_at DESC
    LIMIT 10
  `;

  // Flagged variances
  const flaggedQuery = `
    SELECT 
      b.id AS batch_id, b.batch_code, se.event_time, 
      rd.quantity_received, rd.variance_pct, rd.is_flagged,
      rl.name AS rts_name
    FROM stage_entries se
    JOIN batches b ON b.id = se.batch_id
    JOIN rts_details rd ON rd.entry_id = se.id
    LEFT JOIN rts_locations rl ON rl.id = rd.rts_location_id
    WHERE se.status = 'ACTIVE' AND rd.is_flagged = true
    ORDER BY se.event_time DESC
    LIMIT 10
  `;

  // Execute all 3 queries in parallel
  const [updatesRes, correctionsRes, flaggedRes] = await Promise.all([
    query(updatesQuery, params),
    query(correctionsQuery),
    query(flaggedQuery),
  ]);

  const result = {
    recent_updates: updatesRes.rows,
    recent_corrections: correctionsRes.rows,
    flagged_variances: flaggedRes.rows.map((r) => ({
      ...r,
      variance_pct: Number(r.variance_pct),
      quantity_received: Number(r.quantity_received),
    })),
  };

  setCached(cacheKey, result);
  return result;
}

export async function getQueue(user) {
  // Query all active assignments for this stage operator
  const stage = user.role;
  const assignmentsRes = await query(
    `SELECT 
       b.id, b.batch_code, b.batch_date, b.waste_type, b.quantity, b.source_area, 
       b.current_status, b.current_stage, b.created_at,
       r.name AS route_name, r.code AS route_code,
       v.vehicle_number,
       ba.assigned_at,
       -- Own stage active entry
       se_own.id AS own_entry_id,
       se_own.version_no AS own_version_no,
       -- Transportation details if Transportation stage
       td.arrival_time AS own_arrival_time,
       -- Preceding stage entry
       se_prev.id AS prev_entry_id,
       td_prev.arrival_time AS prev_arrival_time
     FROM batch_assignments ba
     JOIN batches b ON b.id = ba.batch_id
     LEFT JOIN routes r ON r.id = b.route_id
     LEFT JOIN vehicles v ON v.id = b.vehicle_id
     LEFT JOIN stage_entries se_own ON se_own.batch_id = b.id AND se_own.stage = $1 AND se_own.status = 'ACTIVE'
     LEFT JOIN transportation_details td ON td.entry_id = se_own.id
     -- Preceding stage entry join
     LEFT JOIN stage_entries se_prev ON se_prev.batch_id = b.id AND se_prev.status = 'ACTIVE' AND (
       ($1 = 'TRANSPORTATION' AND se_prev.stage = 'COLLECTION') OR
       ($1 = 'RTS' AND se_prev.stage = 'TRANSPORTATION') OR
       ($1 = 'PROCESSING' AND se_prev.stage = 'RTS')
     )
     LEFT JOIN transportation_details td_prev ON td_prev.entry_id = se_prev.id
     WHERE ba.user_id = $2 AND ba.stage = $1 AND ba.is_active = true
     ORDER BY b.batch_date DESC, b.created_at DESC`,
    [stage, user.id]
  );

  const ready = [];
  const locked = [];
  const submitted = [];
  let inTransitCount = 0;

  for (const row of assignmentsRes.rows) {
    const item = {
      id: row.id,
      batch_code: row.batch_code,
      batch_date: row.batch_date,
      waste_type: row.waste_type,
      quantity: Number(row.quantity),
      source_area: row.source_area,
      route_name: row.route_name,
      route_code: row.route_code,
      vehicle_number: row.vehicle_number,
      assigned_at: row.assigned_at,
      current_status: row.current_status,
      current_stage: row.current_stage,
      entry_id: row.own_entry_id,
      version_no: row.own_version_no,
    };

    // If own stage already submitted:
    if (row.own_entry_id) {
      if (stage === 'TRANSPORTATION' && !row.own_arrival_time) {
        inTransitCount++;
      }
      submitted.push(item);
      continue;
    }

    // If own stage not submitted yet: check if locked or ready
    if (stage === 'COLLECTION') {
      ready.push(item);
    } else if (stage === 'TRANSPORTATION') {
      if (!row.prev_entry_id) {
        locked.push({ ...item, lock_reason: 'Waiting for Collection stage completion' });
      } else {
        ready.push(item);
      }
    } else if (stage === 'RTS') {
      if (!row.prev_entry_id) {
        locked.push({ ...item, lock_reason: 'Waiting for Transportation stage' });
      } else if (!row.prev_arrival_time) {
        locked.push({ ...item, lock_reason: 'Waiting for Transportation vehicle arrival time' });
      } else {
        ready.push(item);
      }
    } else if (stage === 'PROCESSING') {
      if (!row.prev_entry_id) {
        locked.push({ ...item, lock_reason: 'Waiting for RTS stage handover' });
      } else {
        ready.push(item);
      }
    }
  }

  return {
    counts: {
      ready_count: ready.length,
      locked_count: locked.length,
      submitted_count: submitted.length,
      in_transit_count: inTransitCount,
    },
    ready,
    locked,
    submitted,
  };
}

