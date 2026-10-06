import { config } from '../config/env.js';
import { getClient, query } from '../db/index.js';
import { AppError, ErrorCodes } from '../utils/errors.js';
import { logAudit } from './auditService.js';
import { invalidateDashboardCache } from './dashboardService.js';

export async function createBatch(data, adminId) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // 1. Verify route and vehicle are active
    const routeRes = await client.query('SELECT id, is_active FROM routes WHERE id = $1', [data.route_id]);
    if (routeRes.rows.length === 0 || !routeRes.rows[0].is_active) {
      throw new AppError(422, ErrorCodes.VALIDATION_FAILED, 'Selected route does not exist or is inactive');
    }

    const vehRes = await client.query('SELECT id, is_active FROM vehicles WHERE id = $1', [data.vehicle_id]);
    if (vehRes.rows.length === 0 || !vehRes.rows[0].is_active) {
      throw new AppError(422, ErrorCodes.VALIDATION_FAILED, 'Selected vehicle does not exist or is inactive');
    }

    // 2. Parse assignees
    let assignmentsList = [];
    if (Array.isArray(data.assignments)) {
      assignmentsList = data.assignments;
    } else {
      assignmentsList = [
        { stage: 'COLLECTION', user_id: data.assignments.collection_user_id },
        { stage: 'TRANSPORTATION', user_id: data.assignments.transportation_user_id },
        { stage: 'RTS', user_id: data.assignments.rts_user_id },
        { stage: 'PROCESSING', user_id: data.assignments.processing_user_id },
      ];
    }

    // 3. Verify each assigned user exists, is active, and matches stage
    for (const assign of assignmentsList) {
      const uRes = await client.query('SELECT id, role, is_active FROM users WHERE id = $1', [assign.user_id]);
      if (uRes.rows.length === 0 || !uRes.rows[0].is_active) {
        throw new AppError(
          422,
          ErrorCodes.VALIDATION_FAILED,
          `Assigned user for stage ${assign.stage} does not exist or is inactive`
        );
      }
      if (uRes.rows[0].role !== assign.stage) {
        throw new AppError(
          422,
          ErrorCodes.VALIDATION_FAILED,
          `User assigned to stage ${assign.stage} must have role '${assign.stage}', found '${uRes.rows[0].role}'`
        );
      }
    }

    // 4. Generate batch code from sequence WB-YYYY-NNNN
    const codeRes = await client.query('SELECT generate_batch_code() AS batch_code');
    const batchCode = codeRes.rows[0].batch_code;

    // 5. Insert batch
    const insertBatchSql = `
      INSERT INTO batches (
        batch_code, batch_date, waste_type, quantity, source_area, 
        route_id, vehicle_id, initial_status, current_status, current_stage, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'CREATED', 'CREATED', NULL, $8)
      RETURNING *
    `;

    const batchRes = await client.query(insertBatchSql, [
      batchCode,
      data.batch_date,
      data.waste_type,
      data.quantity,
      data.source_area,
      data.route_id,
      data.vehicle_id,
      adminId,
    ]);

    const createdBatch = batchRes.rows[0];

    // 6. Insert 4 batch assignments
    const insertedAssignments = [];
    for (const assign of assignmentsList) {
      const assignRes = await client.query(
        `INSERT INTO batch_assignments (batch_id, stage, user_id, assigned_by, is_active)
         VALUES ($1, $2, $3, $4, true)
         RETURNING *`,
        [createdBatch.id, assign.stage, assign.user_id, adminId]
      );
      insertedAssignments.push(assignRes.rows[0]);
    }

    // 7. Write audit logs
    await logAudit({
      action: 'BATCH_CREATE',
      batchId: createdBatch.id,
      entityType: 'batch',
      entityId: createdBatch.id,
      newValues: createdBatch,
      performedBy: adminId,
      client,
    });

    await logAudit({
      action: 'ASSIGN',
      batchId: createdBatch.id,
      entityType: 'batch_assignments',
      newValues: insertedAssignments,
      reason: 'Initial assignment of 4 stage operators',
      performedBy: adminId,
      client,
    });

    await client.query('COMMIT');
    invalidateDashboardCache();

    return {
      batch: createdBatch,
      assignments: insertedAssignments,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function listBatches(
  user,
  {
    search,
    status,
    waste_type,
    route_id,
    vehicle_id,
    start_date,
    end_date,
    sort_by = 'created_at',
    sort_order = 'desc',
    limit = 50,
    offset = 0,
  }
) {
  const whereClauses = [];
  const params = [];

  // Stage users are scoped strictly to batches assigned to them for their active stage
  if (user.role !== 'ADMIN' && user.role !== 'HEAD_OFFICER') {
    params.push(user.id);
    whereClauses.push(
      `b.id IN (SELECT batch_id FROM batch_assignments WHERE user_id = $${params.length} AND is_active = true)`
    );
  }

  if (search) {
    params.push(`%${search}%`);
    whereClauses.push(`(b.batch_code ILIKE $${params.length} OR b.source_area ILIKE $${params.length})`);
  }

  if (status) {
    params.push(status);
    whereClauses.push(`b.current_status = $${params.length}`);
  }

  if (waste_type) {
    params.push(waste_type);
    whereClauses.push(`b.waste_type = $${params.length}`);
  }

  if (route_id) {
    params.push(route_id);
    whereClauses.push(`b.route_id = $${params.length}`);
  }

  if (vehicle_id) {
    params.push(vehicle_id);
    whereClauses.push(`b.vehicle_id = $${params.length}`);
  }

  if (start_date) {
    params.push(start_date);
    whereClauses.push(`b.batch_date >= $${params.length}`);
  }

  if (end_date) {
    params.push(end_date);
    whereClauses.push(`b.batch_date <= $${params.length}`);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countQuery = `SELECT count(*) FROM batches b ${whereSql}`;
  const totalRes = await query(countQuery, params);
  const total = Number(totalRes.rows[0].count);

  const safeSortField = ['batch_date', 'created_at', 'batch_code', 'quantity'].includes(sort_by)
    ? `b.${sort_by}`
    : 'b.created_at';
  const safeSortOrder = sort_order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  params.push(limit);
  const limitParam = `$${params.length}`;
  params.push(offset);
  const offsetParam = `$${params.length}`;

  const listQuery = `
    SELECT 
      b.*,
      r.code AS route_code,
      r.name AS route_name,
      v.vehicle_number
    FROM batches b
    LEFT JOIN routes r ON r.id = b.route_id
    LEFT JOIN vehicles v ON v.id = b.vehicle_id
    ${whereSql}
    ORDER BY ${safeSortField} ${safeSortOrder}
    LIMIT ${limitParam} OFFSET ${offsetParam}
  `;

  const rowsRes = await query(listQuery, params);

  return {
    batches: rowsRes.rows,
    total,
    limit,
    offset,
  };
}

export async function getBatchByIdOrCode(identifier, user) {
  // Support both UUID id and public batch_code
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
  const whereBatch = isUuid ? 'b.id = $1' : 'b.batch_code = $1';

  const batchRes = await query(
    `SELECT 
       b.*,
       r.code AS route_code,
       r.name AS route_name,
       v.vehicle_number,
       v.vehicle_type,
       v.capacity_kg AS vehicle_capacity,
       u.name AS creator_name
     FROM batches b
     LEFT JOIN routes r ON r.id = b.route_id
     LEFT JOIN vehicles v ON v.id = b.vehicle_id
     LEFT JOIN users u ON u.id = b.created_by
     WHERE ${whereBatch}`,
    [identifier]
  );

  if (batchRes.rows.length === 0) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, `Batch not found with identifier: ${identifier}`);
  }

  const batch = batchRes.rows[0];

  // Stage operator access check: must be assigned to this batch
  if (user.role !== 'ADMIN' && user.role !== 'HEAD_OFFICER') {
    const assignCheck = await query(
      `SELECT id FROM batch_assignments 
       WHERE batch_id = $1 AND user_id = $2 AND is_active = true`,
      [batch.id, user.id]
    );
    if (assignCheck.rows.length === 0) {
      throw new AppError(
        403,
        ErrorCodes.NOT_ASSIGNED,
        `You are not assigned to batch ${batch.batch_code}. Access denied.`
      );
    }
  }

  // Fetch active assignments
  const assignmentsRes = await query(
    `SELECT 
       ba.id, ba.stage, ba.user_id, ba.assigned_at, ba.is_active,
       u.name AS user_name, u.email AS user_email, u.role AS user_role
     FROM batch_assignments ba
     JOIN users u ON u.id = ba.user_id
     WHERE ba.batch_id = $1 AND ba.is_active = true
     ORDER BY ba.assigned_at ASC`,
    [batch.id]
  );

  // Fetch timeline (Active valid entry per stage with detail records)
  const timelineEntriesRes = await query(
    `SELECT 
       se.*,
       u.name AS creator_name,
       cd.collection_area, cd.driver_id, d.name AS driver_name,
       td.start_location, td.destination, td.departure_time, td.arrival_time, td.duration_minutes,
       rd.quantity_received, rd.handover_details, rd.variance_pct, rd.is_flagged,
       pd.quantity AS processed_quantity, pd.final_status
     FROM stage_entries se
     LEFT JOIN users u ON u.id = se.created_by
     LEFT JOIN collection_details cd ON cd.entry_id = se.id
     LEFT JOIN drivers d ON d.id = cd.driver_id
     LEFT JOIN transportation_details td ON td.entry_id = se.id
     LEFT JOIN rts_details rd ON rd.entry_id = se.id
     LEFT JOIN processing_details pd ON pd.entry_id = se.id
     WHERE se.batch_id = $1 AND se.status = 'ACTIVE'
     ORDER BY se.created_at ASC`,
    [batch.id]
  );

  // Fetch history
  // For Admin & Head Officer: all versions across all stages
  // For Stage operators: only own stage versions
  let historyWhere = 'se.batch_id = $1';
  const historyParams = [batch.id];

  if (user.role !== 'ADMIN' && user.role !== 'HEAD_OFFICER') {
    historyParams.push(user.role);
    historyWhere += ` AND se.stage = $2`;
  }

  const historyRes = await query(
    `SELECT 
       se.*,
       u.name AS creator_name,
       del.name AS deleted_by_name,
       cd.collection_area, cd.quantity AS collection_qty,
       td.start_location, td.destination, td.departure_time, td.arrival_time, td.duration_minutes,
       rd.quantity_received, rd.variance_pct, rd.is_flagged,
       pd.quantity AS processed_quantity, pd.final_status
     FROM stage_entries se
     LEFT JOIN users u ON u.id = se.created_by
     LEFT JOIN users del ON del.id = se.deleted_by
     LEFT JOIN collection_details cd ON cd.entry_id = se.id
     LEFT JOIN transportation_details td ON td.entry_id = se.id
     LEFT JOIN rts_details rd ON rd.entry_id = se.id
     LEFT JOIN processing_details pd ON pd.entry_id = se.id
     WHERE ${historyWhere}
     ORDER BY se.stage ASC, se.version_no DESC`,
    historyParams
  );

  return {
    batch,
    assignments: assignmentsRes.rows,
    timeline: timelineEntriesRes.rows,
    history: historyRes.rows,
  };
}

export async function updateBatch(id, updates, adminId) {
  const currentRes = await query('SELECT * FROM batches WHERE id = $1', [id]);
  if (currentRes.rows.length === 0) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, 'Batch not found');
  }
  const current = currentRes.rows[0];

  const allowedFields = ['batch_date', 'waste_type', 'quantity', 'source_area', 'route_id', 'vehicle_id'];
  const setClauses = [];
  const params = [id];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      params.push(updates[field]);
      setClauses.push(`${field} = $${params.length}`);
    }
  }

  if (setClauses.length === 0) {
    return current;
  }

  const updateSql = `
    UPDATE batches 
    SET ${setClauses.join(', ')}, updated_at = now() 
    WHERE id = $1 
    RETURNING *
  `;

  const updatedRes = await query(updateSql, params);
  const updatedBatch = updatedRes.rows[0];

  await logAudit({
    action: 'BATCH_EDIT',
    batchId: id,
    entityType: 'batch',
    entityId: id,
    oldValues: current,
    newValues: updatedBatch,
    performedBy: adminId,
  });

  return updatedBatch;
}

export async function reassignBatch(batchId, payload, adminId) {
  let stage = payload.stage;
  let user_id = payload.user_id;
  const reason = payload.reason;

  if (!stage && payload.assignments) {
    if (payload.assignments.collection_user_id) {
      stage = 'COLLECTION';
      user_id = payload.assignments.collection_user_id;
    } else if (payload.assignments.transportation_user_id) {
      stage = 'TRANSPORTATION';
      user_id = payload.assignments.transportation_user_id;
    } else if (payload.assignments.rts_user_id) {
      stage = 'RTS';
      user_id = payload.assignments.rts_user_id;
    } else if (payload.assignments.processing_user_id) {
      stage = 'PROCESSING';
      user_id = payload.assignments.processing_user_id;
    }
  }

  if (!stage || !user_id) {
    throw new AppError(422, ErrorCodes.VALIDATION_FAILED, 'Stage and user_id are required for reassignment');
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Check batch exists by UUID or batch_code
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(batchId);
    const whereBatch = isUuid ? 'id = $1' : 'batch_code = $1';
    const bRes = await client.query(`SELECT id, batch_code FROM batches WHERE ${whereBatch}`, [batchId]);
    if (bRes.rows.length === 0) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, 'Batch not found');
    }
    const actualBatchId = bRes.rows[0].id;

    // Verify new user exists, active, and matches stage
    const uRes = await client.query('SELECT id, name, role, is_active FROM users WHERE id = $1', [user_id]);
    if (uRes.rows.length === 0 || !uRes.rows[0].is_active) {
      throw new AppError(422, ErrorCodes.VALIDATION_FAILED, 'New user does not exist or is inactive');
    }
    if (uRes.rows[0].role !== stage) {
      throw new AppError(
        422,
        ErrorCodes.VALIDATION_FAILED,
        `User role (${uRes.rows[0].role}) does not match stage (${stage})`
      );
    }

    // Find current active assignment
    const oldAssignRes = await client.query(
      `SELECT * FROM batch_assignments 
       WHERE batch_id = $1 AND stage = $2 AND is_active = true`,
      [actualBatchId, stage]
    );
    const oldAssignment = oldAssignRes.rows[0] || null;

    // Deactivate previous assignment
    await client.query(
      `UPDATE batch_assignments 
       SET is_active = false 
       WHERE batch_id = $1 AND stage = $2 AND is_active = true`,
      [actualBatchId, stage]
    );

    // Insert new assignment
    const newAssignRes = await client.query(
      `INSERT INTO batch_assignments (batch_id, stage, user_id, assigned_by, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING *`,
      [actualBatchId, stage, user_id, adminId]
    );
    const newAssignment = newAssignRes.rows[0];

    // Log audit
    await logAudit({
      action: 'REASSIGN',
      batchId: actualBatchId,
      entityType: 'batch_assignments',
      entityId: newAssignment.id,
      oldValues: oldAssignment,
      newValues: newAssignment,
      reason: reason || 'Batch stage reassigned by Administrator',
      performedBy: adminId,
      client,
    });

    await client.query('COMMIT');
    invalidateDashboardCache();

    return newAssignment;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getBatchQr(identifier) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
  const whereBatch = isUuid ? 'id = $1' : 'batch_code = $1';

  const res = await query(`SELECT id, batch_code FROM batches WHERE ${whereBatch}`, [identifier]);
  if (res.rows.length === 0) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, 'Batch not found');
  }

  const batch = res.rows[0];
  const frontendUrl = config.CORS_ORIGIN || 'http://localhost:5174';
  const trackUrl = `${frontendUrl}/track/${batch.batch_code}`;

  return {
    batch_id: batch.id,
    batch_code: batch.batch_code,
    track_url: trackUrl,
  };
}

