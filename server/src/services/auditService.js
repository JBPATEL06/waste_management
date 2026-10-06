import { query } from '../db/index.js';

export async function logAudit({
  action,
  batchId = null,
  entryId = null,
  entityType = null,
  entityId = null,
  oldValues = null,
  newValues = null,
  reason = null,
  performedBy,
  client = null,
}) {
  const q = `
    INSERT INTO audit_log (
      action, batch_id, entry_id, entity_type, entity_id,
      old_values, new_values, reason, performed_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id, performed_at
  `;

  const params = [
    action,
    batchId,
    entryId,
    entityType,
    entityId,
    oldValues ? JSON.stringify(oldValues) : null,
    newValues ? JSON.stringify(newValues) : null,
    reason,
    performedBy,
  ];

  const executor = client || { query };
  const result = await executor.query(q, params);
  return result.rows[0];
}

