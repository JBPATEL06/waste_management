import { query } from '../db/index.js';
import { AppError, ErrorCodes } from '../utils/errors.js';

export async function getPublicTracking(batchCode) {
  const code = batchCode.trim().toUpperCase();

  // 1. Fetch batch
  const batchRes = await query(
    `SELECT id, batch_code, waste_type, quantity, source_area, current_status 
     FROM batches 
     WHERE UPPER(batch_code) = $1`,
    [code]
  );

  if (batchRes.rows.length === 0) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, `Batch '${batchCode}' not found`);
  }

  const batch = batchRes.rows[0];

  // 2. Fetch active timeline entries
  const entriesRes = await query(
    `SELECT stage, event_time, display_location, status 
     FROM stage_entries 
     WHERE batch_id = $1 AND status = 'ACTIVE' 
     ORDER BY 
       CASE stage 
         WHEN 'COLLECTION' THEN 1 
         WHEN 'TRANSPORTATION' THEN 2 
         WHEN 'RTS' THEN 3 
         WHEN 'PROCESSING' THEN 4 
       END ASC`,
    [batch.id]
  );

  // 3. Construct strictly whitelisted response per PRD §4.6
  // Never returns: driver/user names, vehicle numbers, notes, handover details, history, assignments
  return {
    batch_code: batch.batch_code,
    waste_type: batch.waste_type,
    quantity: Number(batch.quantity),
    source_area: batch.source_area,
    current_status: batch.current_status,
    timeline: entriesRes.rows.map((r) => ({
      stage: r.stage,
      event_time: r.event_time,
      display_location: r.display_location,
      status: r.status,
    })),
  };
}

