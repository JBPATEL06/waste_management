import { query } from '../db/index.js';

export async function listAuditLogs({
  action,
  user,
  batch,
  start_date,
  end_date,
  limit = 50,
  offset = 0,
}) {
  const whereClauses = [];
  const params = [];

  if (action && action !== 'ALL') {
    params.push(action);
    whereClauses.push(`al.action = $${params.length}`);
  }

  if (user) {
    params.push(`%${user}%`);
    whereClauses.push(`(u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
  }

  if (batch) {
    params.push(`%${batch}%`);
    whereClauses.push(`b.batch_code ILIKE $${params.length}`);
  }

  if (start_date) {
    params.push(start_date);
    whereClauses.push(`al.performed_at >= $${params.length}`);
  }

  if (end_date) {
    params.push(end_date);
    whereClauses.push(`al.performed_at <= $${params.length}`);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countQuery = `
    SELECT count(*) 
    FROM audit_log al
    JOIN users u ON u.id = al.performed_by
    LEFT JOIN batches b ON b.id = al.batch_id
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
      al.id, al.action, al.batch_id, al.entry_id, al.entity_type, al.entity_id,
      al.old_values, al.new_values, al.reason, al.performed_at,
      u.name AS user_name, u.email AS user_email, u.role AS user_role,
      b.batch_code
    FROM audit_log al
    JOIN users u ON u.id = al.performed_by
    LEFT JOIN batches b ON b.id = al.batch_id
    ${whereSql}
    ORDER BY al.performed_at DESC
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

