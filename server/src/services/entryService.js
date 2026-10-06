import { getClient, query } from '../db/index.js';
import { AppError, ErrorCodes } from '../utils/errors.js';
import { validateStagePayload } from '../validators/entryValidators.js';
import { logAudit } from './auditService.js';
import { deriveBatchStatus } from './statusService.js';
import { invalidateDashboardCache } from './dashboardService.js';

const STAGE_ORDER = {
  COLLECTION: 1,
  TRANSPORTATION: 2,
  RTS: 3,
  PROCESSING: 4,
};

async function verifyMasterReferences(stage, data, client) {
  if (stage === 'COLLECTION') {
    const rRes = await client.query('SELECT id, is_active FROM routes WHERE id = $1', [data.route_id]);
    if (rRes.rows.length === 0 || !rRes.rows[0].is_active) {
      throw new AppError(422, ErrorCodes.VALIDATION_FAILED, 'Selected route is inactive or does not exist');
    }
    const vRes = await client.query('SELECT id, is_active FROM vehicles WHERE id = $1', [data.vehicle_id]);
    if (vRes.rows.length === 0 || !vRes.rows[0].is_active) {
      throw new AppError(422, ErrorCodes.VALIDATION_FAILED, 'Selected vehicle is inactive or does not exist');
    }
    const dRes = await client.query('SELECT id, is_active FROM drivers WHERE id = $1', [data.driver_id]);
    if (dRes.rows.length === 0 || !dRes.rows[0].is_active) {
      throw new AppError(422, ErrorCodes.VALIDATION_FAILED, 'Selected driver is inactive or does not exist');
    }
  } else if (stage === 'TRANSPORTATION') {
    const locRes = await client.query('SELECT id, is_active FROM rts_locations WHERE id = $1', [data.rts_location_id]);
    if (locRes.rows.length === 0 || !locRes.rows[0].is_active) {
      throw new AppError(422, ErrorCodes.VALIDATION_FAILED, 'Selected RTS location is inactive or does not exist');
    }
    const vRes = await client.query('SELECT id, is_active FROM vehicles WHERE id = $1', [data.vehicle_id]);
    if (vRes.rows.length === 0 || !vRes.rows[0].is_active) {
      throw new AppError(422, ErrorCodes.VALIDATION_FAILED, 'Selected vehicle is inactive or does not exist');
    }
  } else if (stage === 'RTS') {
    const locRes = await client.query('SELECT id, is_active FROM rts_locations WHERE id = $1', [data.rts_location_id]);
    if (locRes.rows.length === 0 || !locRes.rows[0].is_active) {
      throw new AppError(422, ErrorCodes.VALIDATION_FAILED, 'Selected RTS location is inactive or does not exist');
    }
    const catRes = await client.query('SELECT id, is_active FROM waste_categories WHERE id = $1', [data.waste_category_id]);
    if (catRes.rows.length === 0 || !catRes.rows[0].is_active) {
      throw new AppError(422, ErrorCodes.VALIDATION_FAILED, 'Selected waste category is inactive or does not exist');
    }
    const facRes = await client.query('SELECT id, is_active FROM processing_facilities WHERE id = $1', [data.next_facility_id]);
    if (facRes.rows.length === 0 || !facRes.rows[0].is_active) {
      throw new AppError(422, ErrorCodes.VALIDATION_FAILED, 'Selected next facility is inactive or does not exist');
    }
  } else if (stage === 'PROCESSING') {
    const facRes = await client.query('SELECT id, is_active FROM processing_facilities WHERE id = $1', [data.facility_id]);
    if (facRes.rows.length === 0 || !facRes.rows[0].is_active) {
      throw new AppError(422, ErrorCodes.VALIDATION_FAILED, 'Selected facility is inactive or does not exist');
    }
    const typeRes = await client.query('SELECT id, is_active FROM process_types WHERE id = $1', [data.process_type_id]);
    if (typeRes.rows.length === 0 || !typeRes.rows[0].is_active) {
      throw new AppError(422, ErrorCodes.VALIDATION_FAILED, 'Selected process type is inactive or does not exist');
    }
  }
}

async function deriveDisplayLocation(stage, data, client) {
  if (stage === 'COLLECTION') {
    return data.collection_area;
  }
  if (stage === 'TRANSPORTATION') {
    return `${data.start_location} to ${data.destination}`;
  }
  if (stage === 'RTS') {
    const res = await client.query('SELECT name FROM rts_locations WHERE id = $1', [data.rts_location_id]);
    return res.rows[0]?.name || 'RTS Station';
  }
  if (stage === 'PROCESSING') {
    const res = await client.query('SELECT name FROM processing_facilities WHERE id = $1', [data.facility_id]);
    return res.rows[0]?.name || 'Processing Facility';
  }
  return 'Unknown Location';
}

export async function createEntry(batchId, body, user) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // 1. Resolve target stage: strictly from role for stage operators
    const stage = user.role !== 'ADMIN' ? user.role : body.stage;
    if (!stage || !STAGE_ORDER[stage]) {
      throw new AppError(422, ErrorCodes.VALIDATION_FAILED, `Valid stage is required ('${stage}' is invalid)`);
    }

    // 2. Validate payload
    const validatedData = validateStagePayload(stage, body);

    // 3. Verify batch exists
    const batchRes = await client.query('SELECT * FROM batches WHERE id = $1', [batchId]);
    if (batchRes.rows.length === 0) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, 'Batch not found');
    }
    const batch = batchRes.rows[0];

    // 4. Require assignment check
    if (user.role !== 'ADMIN') {
      const assignRes = await client.query(
        `SELECT id FROM batch_assignments 
         WHERE batch_id = $1 AND stage = $2 AND user_id = $3 AND is_active = true`,
        [batchId, stage, user.id]
      );
      if (assignRes.rows.length === 0) {
        throw new AppError(
          403,
          ErrorCodes.NOT_ASSIGNED,
          `You are not the active assignee for this batch at stage ${stage}`
        );
      }
    }

    // 5. Check if ACTIVE entry already exists
    const existingActive = await client.query(
      `SELECT id FROM stage_entries 
       WHERE batch_id = $1 AND stage = $2 AND status = 'ACTIVE'`,
      [batchId, stage]
    );
    if (existingActive.rows.length > 0) {
      throw new AppError(
        409,
        ErrorCodes.ENTRY_EXISTS,
        `An active entry for stage ${stage} already exists on this batch. Please use the correction flow.`
      );
    }

    // 6. Sequential workflow checks and time order validation
    if (stage === 'TRANSPORTATION') {
      const collRes = await client.query(
        `SELECT id, event_time FROM stage_entries 
         WHERE batch_id = $1 AND stage = 'COLLECTION' AND status = 'ACTIVE'`,
        [batchId]
      );
      if (collRes.rows.length === 0) {
        throw new AppError(409, ErrorCodes.STAGE_LOCKED, 'Collection stage must be completed before Transportation');
      }
      const collTime = new Date(collRes.rows[0].event_time);
      const depTime = new Date(validatedData.event_time);
      if (depTime < collTime) {
        throw new AppError(
          422,
          ErrorCodes.VALIDATION_FAILED,
          `Transportation departure time cannot be earlier than Collection time (${collTime.toISOString()})`
        );
      }
    } else if (stage === 'RTS') {
      const transRes = await client.query(
        `SELECT se.id, se.event_time, td.arrival_time 
         FROM stage_entries se 
         JOIN transportation_details td ON td.entry_id = se.id 
         WHERE se.batch_id = $1 AND se.stage = 'TRANSPORTATION' AND se.status = 'ACTIVE'`,
        [batchId]
      );
      if (transRes.rows.length === 0) {
        throw new AppError(409, ErrorCodes.STAGE_LOCKED, 'Transportation stage must be completed before RTS');
      }
      if (!transRes.rows[0].arrival_time) {
        throw new AppError(
          409,
          ErrorCodes.STAGE_LOCKED,
          'Transportation arrival time must be recorded before RTS entry can be created'
        );
      }
      const arrTime = new Date(transRes.rows[0].arrival_time);
      const rtsTime = new Date(validatedData.event_time);
      if (rtsTime < arrTime) {
        throw new AppError(
          422,
          ErrorCodes.VALIDATION_FAILED,
          `RTS arrival time cannot be earlier than Transportation arrival time (${arrTime.toISOString()})`
        );
      }
    } else if (stage === 'PROCESSING') {
      const rtsRes = await client.query(
        `SELECT id, event_time FROM stage_entries 
         WHERE batch_id = $1 AND stage = 'RTS' AND status = 'ACTIVE'`,
        [batchId]
      );
      if (rtsRes.rows.length === 0) {
        throw new AppError(409, ErrorCodes.STAGE_LOCKED, 'RTS stage must be completed before Processing');
      }
      const rtsTime = new Date(rtsRes.rows[0].event_time);
      const procTime = new Date(validatedData.event_time);
      if (procTime < rtsTime) {
        throw new AppError(
          422,
          ErrorCodes.VALIDATION_FAILED,
          `Processing arrival time cannot be earlier than RTS arrival time (${rtsTime.toISOString()})`
        );
      }
    }

    // 7. Verify Master reference rows
    await verifyMasterReferences(stage, validatedData, client);

    // 8. Derive display location
    const displayLocation = await deriveDisplayLocation(stage, validatedData, client);

    // 9. RTS Variance calculation and threshold flagging
    let variancePct = null;
    let isFlagged = false;

    if (stage === 'RTS') {
      const collQtyRes = await client.query(
        `SELECT cd.quantity 
         FROM stage_entries se 
         JOIN collection_details cd ON cd.entry_id = se.id 
         WHERE se.batch_id = $1 AND se.stage = 'COLLECTION' AND se.status = 'ACTIVE'`,
        [batchId]
      );
      const collQty = Number(collQtyRes.rows[0]?.quantity || batch.quantity);
      if (collQty > 0) {
        const receivedQty = Number(validatedData.quantity_received);
        variancePct = Number((((receivedQty - collQty) / collQty) * 100).toFixed(2));

        const settRes = await client.query(`SELECT value FROM app_settings WHERE key = 'variance_threshold_pct'`);
        const threshold = Number(settRes.rows[0]?.value || 10);
        isFlagged = Math.abs(variancePct) > threshold;
      }
    }

    // 10. Insert into stage_entries
    const insertEntrySql = `
      INSERT INTO stage_entries (
        batch_id, stage, version_no, status, event_time, display_location, note, created_by
      ) VALUES ($1, $2, 1, 'ACTIVE', $3, $4, $5, $6)
      RETURNING *
    `;

    const entryRes = await client.query(insertEntrySql, [
      batchId,
      stage,
      validatedData.event_time,
      displayLocation,
      validatedData.note || null,
      user.id,
    ]);
    const createdEntry = entryRes.rows[0];

    // 11. Insert into matching detail table
    let createdDetail = null;

    if (stage === 'COLLECTION') {
      const dRes = await client.query(
        `INSERT INTO collection_details (
           entry_id, collection_area, route_id, vehicle_id, waste_type, quantity, driver_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          createdEntry.id,
          validatedData.collection_area,
          validatedData.route_id,
          validatedData.vehicle_id,
          validatedData.waste_type,
          validatedData.quantity,
          validatedData.driver_id,
        ]
      );
      createdDetail = dRes.rows[0];
    } else if (stage === 'TRANSPORTATION') {
      const dRes = await client.query(
        `INSERT INTO transportation_details (
           entry_id, start_location, destination, rts_location_id, vehicle_id, departure_time, arrival_time
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          createdEntry.id,
          validatedData.start_location,
          validatedData.destination,
          validatedData.rts_location_id,
          validatedData.vehicle_id,
          validatedData.event_time, // departure_time equals event_time
          validatedData.arrival_time || null,
        ]
      );
      createdDetail = dRes.rows[0];
    } else if (stage === 'RTS') {
      const dRes = await client.query(
        `INSERT INTO rts_details (
           entry_id, rts_location_id, quantity_received, waste_category_id, handover_details, 
           next_facility_id, variance_pct, is_flagged
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          createdEntry.id,
          validatedData.rts_location_id,
          validatedData.quantity_received,
          validatedData.waste_category_id,
          validatedData.handover_details,
          validatedData.next_facility_id,
          variancePct,
          isFlagged,
        ]
      );
      createdDetail = dRes.rows[0];
    } else if (stage === 'PROCESSING') {
      const dRes = await client.query(
        `INSERT INTO processing_details (
           entry_id, facility_id, process_type_id, quantity, final_status
         ) VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          createdEntry.id,
          validatedData.facility_id,
          validatedData.process_type_id,
          validatedData.quantity,
          validatedData.final_status,
        ]
      );
      createdDetail = dRes.rows[0];
    }

    // 12. Transactionally update batch status and stage
    const updatedBatch = await deriveBatchStatus(client, batchId);

    // 13. Write audit log
    await logAudit({
      action: 'ENTRY_CREATE',
      batchId,
      entryId: createdEntry.id,
      entityType: 'stage_entry',
      entityId: createdEntry.id,
      newValues: { entry: createdEntry, details: createdDetail },
      performedBy: user.id,
      client,
    });

    await client.query('COMMIT');
    invalidateDashboardCache();

    return {
      entry: createdEntry,
      detail: createdDetail,
      batch: updatedBatch,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function correctEntry(entryId, body, user) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { reason, ...data } = body;
    if (!reason || reason.trim().length < 3) {
      throw new AppError(422, ErrorCodes.VALIDATION_FAILED, 'Correction reason is mandatory (minimum 3 characters)');
    }

    // 1. Fetch current entry
    const entryRes = await client.query('SELECT * FROM stage_entries WHERE id = $1', [entryId]);
    if (entryRes.rows.length === 0) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, 'Stage entry not found');
    }
    const currentEntry = entryRes.rows[0];

    if (currentEntry.status !== 'ACTIVE') {
      throw new AppError(409, ErrorCodes.CONFLICT, 'Only ACTIVE stage entries can be corrected');
    }

    // 2. Role / Assignment validation
    if (user.role !== 'ADMIN') {
      if (user.role !== currentEntry.stage) {
        throw new AppError(
          403,
          ErrorCodes.FORBIDDEN_ROLE,
          `Cannot correct entry for stage ${currentEntry.stage} with role ${user.role}`
        );
      }
      const assignRes = await client.query(
        `SELECT id FROM batch_assignments 
         WHERE batch_id = $1 AND stage = $2 AND user_id = $3 AND is_active = true`,
        [currentEntry.batch_id, currentEntry.stage, user.id]
      );
      if (assignRes.rows.length === 0) {
        throw new AppError(403, ErrorCodes.NOT_ASSIGNED, 'You are not assigned to this batch and stage');
      }
    }

    // 3. Validate new data against stage rules
    const stage = currentEntry.stage;
    const validatedData = validateStagePayload(stage, data);

    await verifyMasterReferences(stage, validatedData, client);
    const displayLocation = await deriveDisplayLocation(stage, validatedData, client);

    // 4. Mark old entry SUPERSEDED
    await client.query(
      `UPDATE stage_entries 
       SET status = 'SUPERSEDED' 
       WHERE id = $1`,
      [entryId]
    );

    // 5. Calculate variance if RTS
    let variancePct = null;
    let isFlagged = false;
    if (stage === 'RTS') {
      const collQtyRes = await client.query(
        `SELECT cd.quantity 
         FROM stage_entries se 
         JOIN collection_details cd ON cd.entry_id = se.id 
         WHERE se.batch_id = $1 AND se.stage = 'COLLECTION' AND se.status = 'ACTIVE'`,
        [currentEntry.batch_id]
      );
      const collQty = Number(collQtyRes.rows[0]?.quantity || 0);
      if (collQty > 0) {
        const receivedQty = Number(validatedData.quantity_received);
        variancePct = Number((((receivedQty - collQty) / collQty) * 100).toFixed(2));
        const settRes = await client.query(`SELECT value FROM app_settings WHERE key = 'variance_threshold_pct'`);
        const threshold = Number(settRes.rows[0]?.value || 10);
        isFlagged = Math.abs(variancePct) > threshold;
      }
    }

    // 6. Insert new version (version_no + 1, supersedes_id = old_id)
    const newVersionNo = currentEntry.version_no + 1;
    const insertSql = `
      INSERT INTO stage_entries (
        batch_id, stage, version_no, status, supersedes_id, event_time, display_location, note, created_by
      ) VALUES ($1, $2, $3, 'ACTIVE', $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const newEntryRes = await client.query(insertSql, [
      currentEntry.batch_id,
      stage,
      newVersionNo,
      currentEntry.id,
      validatedData.event_time,
      displayLocation,
      validatedData.note || null,
      user.id,
    ]);
    const newEntry = newEntryRes.rows[0];

    // 7. Insert matching detail row
    let newDetail = null;
    if (stage === 'COLLECTION') {
      const dRes = await client.query(
        `INSERT INTO collection_details (
           entry_id, collection_area, route_id, vehicle_id, waste_type, quantity, driver_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          newEntry.id,
          validatedData.collection_area,
          validatedData.route_id,
          validatedData.vehicle_id,
          validatedData.waste_type,
          validatedData.quantity,
          validatedData.driver_id,
        ]
      );
      newDetail = dRes.rows[0];
    } else if (stage === 'TRANSPORTATION') {
      const dRes = await client.query(
        `INSERT INTO transportation_details (
           entry_id, start_location, destination, rts_location_id, vehicle_id, departure_time, arrival_time
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          newEntry.id,
          validatedData.start_location,
          validatedData.destination,
          validatedData.rts_location_id,
          validatedData.vehicle_id,
          validatedData.event_time,
          validatedData.arrival_time || null,
        ]
      );
      newDetail = dRes.rows[0];
    } else if (stage === 'RTS') {
      const dRes = await client.query(
        `INSERT INTO rts_details (
           entry_id, rts_location_id, quantity_received, waste_category_id, handover_details,
           next_facility_id, variance_pct, is_flagged
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          newEntry.id,
          validatedData.rts_location_id,
          validatedData.quantity_received,
          validatedData.waste_category_id,
          validatedData.handover_details,
          validatedData.next_facility_id,
          variancePct,
          isFlagged,
        ]
      );
      newDetail = dRes.rows[0];
    } else if (stage === 'PROCESSING') {
      const dRes = await client.query(
        `INSERT INTO processing_details (
           entry_id, facility_id, process_type_id, quantity, final_status
         ) VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          newEntry.id,
          validatedData.facility_id,
          validatedData.process_type_id,
          validatedData.quantity,
          validatedData.final_status,
        ]
      );
      newDetail = dRes.rows[0];
    }

    // 8. Re-derive batch status
    const updatedBatch = await deriveBatchStatus(client, currentEntry.batch_id);

    // 9. Audit log
    await logAudit({
      action: 'ENTRY_CORRECT',
      batchId: currentEntry.batch_id,
      entryId: newEntry.id,
      entityType: 'stage_entry',
      entityId: newEntry.id,
      reason,
      oldValues: { superseded_entry_id: currentEntry.id, version_no: currentEntry.version_no },
      newValues: { entry: newEntry, detail: newDetail },
      performedBy: user.id,
      client,
    });

    await client.query('COMMIT');
    invalidateDashboardCache();

    return {
      entry: newEntry,
      detail: newDetail,
      batch: updatedBatch,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function adminEditEntry(entryId, body, adminId) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { reason, ...data } = body;
    if (!reason || reason.trim().length < 3) {
      throw new AppError(422, ErrorCodes.VALIDATION_FAILED, 'Edit reason is mandatory (minimum 3 characters)');
    }

    const entryRes = await client.query('SELECT * FROM stage_entries WHERE id = $1', [entryId]);
    if (entryRes.rows.length === 0) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, 'Stage entry not found');
    }
    const currentEntry = entryRes.rows[0];
    if (currentEntry.status !== 'ACTIVE') {
      throw new AppError(409, ErrorCodes.CONFLICT, 'Only ACTIVE entries can be edited');
    }

    const stage = currentEntry.stage;
    const validatedData = validateStagePayload(stage, data);

    await verifyMasterReferences(stage, validatedData, client);
    const displayLocation = await deriveDisplayLocation(stage, validatedData, client);

    // Fetch old details
    let oldDetails = null;
    let updatedDetail = null;

    if (stage === 'COLLECTION') {
      oldDetails = (await client.query('SELECT * FROM collection_details WHERE entry_id = $1', [entryId])).rows[0];
      const res = await client.query(
        `UPDATE collection_details 
         SET collection_area = $1, route_id = $2, vehicle_id = $3, waste_type = $4, quantity = $5, driver_id = $6
         WHERE entry_id = $7
         RETURNING *`,
        [
          validatedData.collection_area,
          validatedData.route_id,
          validatedData.vehicle_id,
          validatedData.waste_type,
          validatedData.quantity,
          validatedData.driver_id,
          entryId,
        ]
      );
      updatedDetail = res.rows[0];
    } else if (stage === 'TRANSPORTATION') {
      oldDetails = (await client.query('SELECT * FROM transportation_details WHERE entry_id = $1', [entryId])).rows[0];
      const res = await client.query(
        `UPDATE transportation_details 
         SET start_location = $1, destination = $2, rts_location_id = $3, vehicle_id = $4, departure_time = $5, arrival_time = $6
         WHERE entry_id = $7
         RETURNING *`,
        [
          validatedData.start_location,
          validatedData.destination,
          validatedData.rts_location_id,
          validatedData.vehicle_id,
          validatedData.event_time,
          validatedData.arrival_time || null,
          entryId,
        ]
      );
      updatedDetail = res.rows[0];
    } else if (stage === 'RTS') {
      oldDetails = (await client.query('SELECT * FROM rts_details WHERE entry_id = $1', [entryId])).rows[0];
      const collQtyRes = await client.query(
        `SELECT cd.quantity 
         FROM stage_entries se 
         JOIN collection_details cd ON cd.entry_id = se.id 
         WHERE se.batch_id = $1 AND se.stage = 'COLLECTION' AND se.status = 'ACTIVE'`,
        [currentEntry.batch_id]
      );
      const collQty = Number(collQtyRes.rows[0]?.quantity || 0);
      let variancePct = null;
      let isFlagged = false;
      if (collQty > 0) {
        const receivedQty = Number(validatedData.quantity_received);
        variancePct = Number((((receivedQty - collQty) / collQty) * 100).toFixed(2));
        const settRes = await client.query(`SELECT value FROM app_settings WHERE key = 'variance_threshold_pct'`);
        const threshold = Number(settRes.rows[0]?.value || 10);
        isFlagged = Math.abs(variancePct) > threshold;
      }
      const res = await client.query(
        `UPDATE rts_details 
         SET rts_location_id = $1, quantity_received = $2, waste_category_id = $3, handover_details = $4, 
             next_facility_id = $5, variance_pct = $6, is_flagged = $7
         WHERE entry_id = $8
         RETURNING *`,
        [
          validatedData.rts_location_id,
          validatedData.quantity_received,
          validatedData.waste_category_id,
          validatedData.handover_details,
          validatedData.next_facility_id,
          variancePct,
          isFlagged,
          entryId,
        ]
      );
      updatedDetail = res.rows[0];
    } else if (stage === 'PROCESSING') {
      oldDetails = (await client.query('SELECT * FROM processing_details WHERE entry_id = $1', [entryId])).rows[0];
      const res = await client.query(
        `UPDATE processing_details 
         SET facility_id = $1, process_type_id = $2, quantity = $3, final_status = $4
         WHERE entry_id = $5
         RETURNING *`,
        [
          validatedData.facility_id,
          validatedData.process_type_id,
          validatedData.quantity,
          validatedData.final_status,
          entryId,
        ]
      );
      updatedDetail = res.rows[0];
    }

    // Update parent stage entry
    const updatedEntryRes = await client.query(
      `UPDATE stage_entries 
       SET event_time = $1, display_location = $2, note = $3
       WHERE id = $4
       RETURNING *`,
      [validatedData.event_time, displayLocation, validatedData.note || null, entryId]
    );
    const updatedEntry = updatedEntryRes.rows[0];

    const updatedBatch = await deriveBatchStatus(client, currentEntry.batch_id);

    await logAudit({
      action: 'ENTRY_ADMIN_EDIT',
      batchId: currentEntry.batch_id,
      entryId,
      entityType: 'stage_entry',
      entityId: entryId,
      reason,
      oldValues: { entry: currentEntry, detail: oldDetails },
      newValues: { entry: updatedEntry, detail: updatedDetail },
      performedBy: adminId,
      client,
    });

    await client.query('COMMIT');
    invalidateDashboardCache();

    return {
      entry: updatedEntry,
      detail: updatedDetail,
      batch: updatedBatch,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function adminDeleteEntry(entryId, reason, adminId) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    if (!reason || reason.trim().length < 3) {
      throw new AppError(422, ErrorCodes.VALIDATION_FAILED, 'Deletion reason is mandatory (minimum 3 characters)');
    }

    const entryRes = await client.query('SELECT * FROM stage_entries WHERE id = $1', [entryId]);
    if (entryRes.rows.length === 0) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, 'Stage entry not found');
    }
    const currentEntry = entryRes.rows[0];

    if (currentEntry.status !== 'ACTIVE') {
      throw new AppError(409, ErrorCodes.CONFLICT, 'Only ACTIVE entries can be deleted');
    }

    // Strict reverse-order deletion rule:
    // Block if any later stage has an ACTIVE entry!
    const activeEntriesRes = await client.query(
      `SELECT stage FROM stage_entries 
       WHERE batch_id = $1 AND status = 'ACTIVE' AND id != $2`,
      [currentEntry.batch_id, entryId]
    );

    const currentOrder = STAGE_ORDER[currentEntry.stage];
    for (const r of activeEntriesRes.rows) {
      const order = STAGE_ORDER[r.stage];
      if (order > currentOrder) {
        throw new AppError(
          409,
          ErrorCodes.DELETE_BLOCKED,
          `Cannot delete ${currentEntry.stage} entry because subsequent stage entry '${r.stage}' is active. Delete subsequent stages first.`
        );
      }
    }

    // Soft delete
    const delRes = await client.query(
      `UPDATE stage_entries 
       SET status = 'DELETED', 
           deleted_by = $1, 
           deleted_at = now(), 
           delete_reason = $2 
       WHERE id = $3 
       RETURNING *`,
      [adminId, reason, entryId]
    );
    const deletedEntry = delRes.rows[0];

    // Re-derive batch status
    const updatedBatch = await deriveBatchStatus(client, currentEntry.batch_id);

    // Audit log
    await logAudit({
      action: 'ENTRY_ADMIN_DELETE',
      batchId: currentEntry.batch_id,
      entryId,
      entityType: 'stage_entry',
      entityId: entryId,
      reason,
      oldValues: currentEntry,
      newValues: deletedEntry,
      performedBy: adminId,
      client,
    });

    await client.query('COMMIT');
    invalidateDashboardCache();

    return {
      message: 'Stage entry deleted successfully',
      batch: updatedBatch,
      deletedEntry,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getMyHistory(user, { search, status, start_date, end_date, limit = 50, offset = 0 }) {
  const whereClauses = ['se.created_by = $1'];
  const params = [user.id];

  if (search) {
    params.push(`%${search}%`);
    whereClauses.push(`b.batch_code ILIKE $${params.length}`);
  }

  if (status) {
    params.push(status);
    whereClauses.push(`se.status = $${params.length}`);
  }

  if (start_date) {
    params.push(start_date);
    whereClauses.push(`se.event_time >= $${params.length}`);
  }

  if (end_date) {
    params.push(end_date);
    whereClauses.push(`se.event_time <= $${params.length}`);
  }

  const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

  const countQuery = `
    SELECT count(*) 
    FROM stage_entries se
    JOIN batches b ON b.id = se.batch_id
    ${whereSql}
  `;
  const countRes = await query(countQuery, params);
  const total = Number(countRes.rows[0].count);

  params.push(limit);
  const limitParam = `$${params.length}`;
  params.push(offset);
  const offsetParam = `$${params.length}`;

  const listQuery = `
    SELECT 
      se.id, se.batch_id, se.stage, se.version_no, se.status, se.event_time, 
      se.display_location, se.note, se.created_at, se.delete_reason,
      b.batch_code, b.current_status AS batch_status,
      cd.quantity AS collection_qty,
      td.duration_minutes,
      rd.quantity_received, rd.variance_pct, rd.is_flagged,
      pd.quantity AS processed_qty, pd.final_status
    FROM stage_entries se
    JOIN batches b ON b.id = se.batch_id
    LEFT JOIN collection_details cd ON cd.entry_id = se.id
    LEFT JOIN transportation_details td ON td.entry_id = se.id
    LEFT JOIN rts_details rd ON rd.entry_id = se.id
    LEFT JOIN processing_details pd ON pd.entry_id = se.id
    ${whereSql}
    ORDER BY se.created_at DESC
    LIMIT ${limitParam} OFFSET ${offsetParam}
  `;

  const rowsRes = await query(listQuery, params);

  return {
    entries: rowsRes.rows,
    total,
    limit,
    offset,
  };
}

