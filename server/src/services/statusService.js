/**
 * Helper to derive batch status transactionally from active stage entries:
 * - PROCESSING active -> COMPLETED
 * - RTS active -> AT_RTS
 * - TRANSPORTATION active -> IN_TRANSIT
 * - COLLECTION active -> COLLECTED
 * - None active -> CREATED
 */
export async function deriveBatchStatus(client, batchId) {
  const result = await client.query(
    `SELECT stage 
     FROM stage_entries 
     WHERE batch_id = $1 AND status = 'ACTIVE'`,
    [batchId]
  );

  const activeStages = new Set(result.rows.map((r) => r.stage));

  let currentStage = null;
  let currentStatus = 'CREATED';

  if (activeStages.has('PROCESSING')) {
    currentStage = 'PROCESSING';
    currentStatus = 'COMPLETED';
  } else if (activeStages.has('RTS')) {
    currentStage = 'RTS';
    currentStatus = 'AT_RTS';
  } else if (activeStages.has('TRANSPORTATION')) {
    currentStage = 'TRANSPORTATION';
    currentStatus = 'IN_TRANSIT';
  } else if (activeStages.has('COLLECTION')) {
    currentStage = 'COLLECTION';
    currentStatus = 'COLLECTED';
  }

  const updateRes = await client.query(
    `UPDATE batches 
     SET current_stage = $1, 
         current_status = $2, 
         updated_at = now() 
     WHERE id = $3 
     RETURNING *`,
    [currentStage, currentStatus, batchId]
  );

  return updateRes.rows[0];
}

