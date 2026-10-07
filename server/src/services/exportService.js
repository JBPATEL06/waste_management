import { stringify } from 'csv-stringify';
import ExcelJS from 'exceljs';
import { query } from '../db/index.js';
import { AppError, ErrorCodes } from '../utils/errors.js';

function buildFilterSql(filters) {
  const whereClauses = [];
  const params = [];

  if (filters.status) {
    params.push(filters.status);
    whereClauses.push(`b.current_status = $${params.length}`);
  }

  if (filters.waste_type && filters.waste_type !== 'ALL') {
    params.push(filters.waste_type);
    whereClauses.push(`b.waste_type = $${params.length}`);
  }

  if (filters.route_id && filters.route_id !== 'ALL') {
    params.push(filters.route_id);
    whereClauses.push(`b.route_id = $${params.length}`);
  }

  if (filters.vehicle_id && filters.vehicle_id !== 'ALL') {
    params.push(filters.vehicle_id);
    whereClauses.push(`b.vehicle_id = $${params.length}`);
  }

  if (filters.start_date) {
    params.push(filters.start_date);
    whereClauses.push(`b.batch_date >= $${params.length}`);
  }

  if (filters.end_date) {
    params.push(filters.end_date);
    whereClauses.push(`b.batch_date <= $${params.length}`);
  }

  if (filters.search) {
    params.push(`%${filters.search}%`);
    whereClauses.push(`(b.batch_code ILIKE $${params.length} OR b.source_area ILIKE $${params.length})`);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  return { whereSql, params };
}

function buildLimitSql(filters, params) {
  if (filters.limit === undefined) return '';
  const parsedLimit = Number(filters.limit);
  const limit = Number.isFinite(parsedLimit) ? Math.min(100, Math.max(1, Math.trunc(parsedLimit))) : 10;
  params.push(limit);
  return `LIMIT $${params.length}`;
}

export async function fetchDatasetRows(dataset, filters = {}) {
  const normDataset = dataset.toLowerCase().replace(/_/g, '-');
  const { whereSql, params } = buildFilterSql(filters);

  if (normDataset === 'batches') {
    const limitSql = buildLimitSql(filters, params);
    const sql = `
      SELECT 
        b.batch_code, b.batch_date, b.waste_type, b.quantity, b.source_area,
        r.code AS route_code, r.name AS route_name,
        v.vehicle_number,
        b.current_status, b.current_stage,
        u_c.name AS collection_operator,
        u_t.name AS transport_operator,
        u_r.name AS rts_operator,
        u_p.name AS processing_operator,
        b.created_at
      FROM batches b
      LEFT JOIN routes r ON r.id = b.route_id
      LEFT JOIN vehicles v ON v.id = b.vehicle_id
      LEFT JOIN batch_assignments ba_c ON ba_c.batch_id = b.id AND ba_c.stage = 'COLLECTION' AND ba_c.is_active = true
      LEFT JOIN users u_c ON u_c.id = ba_c.user_id
      LEFT JOIN batch_assignments ba_t ON ba_t.batch_id = b.id AND ba_t.stage = 'TRANSPORTATION' AND ba_t.is_active = true
      LEFT JOIN users u_t ON u_t.id = ba_t.user_id
      LEFT JOIN batch_assignments ba_r ON ba_r.batch_id = b.id AND ba_r.stage = 'RTS' AND ba_r.is_active = true
      LEFT JOIN users u_r ON u_r.id = ba_r.user_id
      LEFT JOIN batch_assignments ba_p ON ba_p.batch_id = b.id AND ba_p.stage = 'PROCESSING' AND ba_p.is_active = true
      LEFT JOIN users u_p ON u_p.id = ba_p.user_id
      ${whereSql}
      ORDER BY b.created_at DESC
      ${limitSql}
    `;
    const res = await query(sql, params);
    return {
      name: 'Batches',
      columns: [
        { key: 'batch_code', header: 'Batch ID', width: 16 },
        { key: 'batch_date', header: 'Date', width: 12 },
        { key: 'waste_type', header: 'Waste Type', width: 12 },
        { key: 'quantity', header: 'Initial Qty (kg)', width: 16 },
        { key: 'source_area', header: 'Source / Area', width: 24 },
        { key: 'route_code', header: 'Route Code', width: 12 },
        { key: 'route_name', header: 'Route Name', width: 20 },
        { key: 'vehicle_number', header: 'Vehicle', width: 16 },
        { key: 'current_status', header: 'Status', width: 14 },
        { key: 'current_stage', header: 'Current Stage', width: 16 },
        { key: 'collection_operator', header: 'Collection User', width: 18 },
        { key: 'transport_operator', header: 'Transport User', width: 18 },
        { key: 'rts_operator', header: 'RTS User', width: 18 },
        { key: 'processing_operator', header: 'Processing User', width: 18 },
        { key: 'created_at', header: 'Created At', width: 22 },
      ],
      rows: res.rows,
    };
  }

  if (normDataset === 'stage-records') {
    const limitSql = buildLimitSql(filters, params);
    const sql = `
      SELECT 
        b.batch_code, se.stage, se.version_no, se.status, se.event_time, se.display_location,
        COALESCE(cd.quantity, rd.quantity_received, pd.quantity) AS quantity_kg,
        td.duration_minutes,
        rd.variance_pct,
        rd.is_flagged,
        pd.final_status,
        u.name AS operator_name,
        se.note
      FROM stage_entries se
      JOIN batches b ON b.id = se.batch_id
      LEFT JOIN users u ON u.id = se.created_by
      LEFT JOIN collection_details cd ON cd.entry_id = se.id
      LEFT JOIN transportation_details td ON td.entry_id = se.id
      LEFT JOIN rts_details rd ON rd.entry_id = se.id
      LEFT JOIN processing_details pd ON pd.entry_id = se.id
      ${whereSql ? whereSql + " AND se.status = 'ACTIVE'" : "WHERE se.status = 'ACTIVE'"}
      ORDER BY b.batch_code ASC, se.created_at ASC
      ${limitSql}
    `;
    const res = await query(sql, params);
    return {
      name: 'Stage-Records',
      columns: [
        { key: 'batch_code', header: 'Batch ID', width: 16 },
        { key: 'stage', header: 'Stage', width: 16 },
        { key: 'version_no', header: 'Version', width: 10 },
        { key: 'status', header: 'Status', width: 12 },
        { key: 'event_time', header: 'Event Time', width: 22 },
        { key: 'display_location', header: 'Location', width: 24 },
        { key: 'quantity_kg', header: 'Quantity (kg)', width: 14 },
        { key: 'duration_minutes', header: 'Duration (min)', width: 14 },
        { key: 'variance_pct', header: 'Variance %', width: 12 },
        { key: 'is_flagged', header: 'Flagged', width: 10 },
        { key: 'final_status', header: 'Final Status', width: 14 },
        { key: 'operator_name', header: 'Operator', width: 18 },
        { key: 'note', header: 'Notes', width: 24 },
      ],
      rows: res.rows,
    };
  }

  if (normDataset === 'full-history') {
    const limitSql = buildLimitSql(filters, params);
    const sql = `
      SELECT 
        b.batch_code, se.stage, se.version_no, se.status, se.event_time, se.display_location,
        u.name AS operator_name, se.created_at,
        u_del.name AS deleted_by, se.deleted_at, se.delete_reason,
        se.note
      FROM stage_entries se
      JOIN batches b ON b.id = se.batch_id
      LEFT JOIN users u ON u.id = se.created_by
      LEFT JOIN users u_del ON u_del.id = se.deleted_by
      ${whereSql}
      ORDER BY b.batch_code ASC, se.stage ASC, se.version_no DESC
      ${limitSql}
    `;
    const res = await query(sql, params);
    return {
      name: 'Full-History',
      columns: [
        { key: 'batch_code', header: 'Batch ID', width: 16 },
        { key: 'stage', header: 'Stage', width: 16 },
        { key: 'version_no', header: 'Version', width: 10 },
        { key: 'status', header: 'Status', width: 14 },
        { key: 'event_time', header: 'Event Time', width: 22 },
        { key: 'display_location', header: 'Location', width: 24 },
        { key: 'operator_name', header: 'Operator', width: 18 },
        { key: 'created_at', header: 'Created At', width: 22 },
        { key: 'deleted_by', header: 'Deleted By', width: 18 },
        { key: 'deleted_at', header: 'Deleted At', width: 22 },
        { key: 'delete_reason', header: 'Reason / Delete Reason', width: 28 },
        { key: 'note', header: 'Note', width: 24 },
      ],
      rows: res.rows,
    };
  }

  if (normDataset === 'current-status') {
    const limitSql = buildLimitSql(filters, params);
    const sql = `
      SELECT 
        b.batch_code, b.batch_date, b.waste_type, b.quantity, b.source_area,
        r.name AS route_name, v.vehicle_number,
        b.current_status, b.current_stage,
        b.updated_at
      FROM batches b
      LEFT JOIN routes r ON r.id = b.route_id
      LEFT JOIN vehicles v ON v.id = b.vehicle_id
      ${whereSql}
      ORDER BY b.updated_at DESC
      ${limitSql}
    `;
    const res = await query(sql, params);
    return {
      name: 'Current-Status',
      columns: [
        { key: 'batch_code', header: 'Batch ID', width: 16 },
        { key: 'batch_date', header: 'Batch Date', width: 12 },
        { key: 'waste_type', header: 'Waste Type', width: 12 },
        { key: 'quantity', header: 'Quantity (kg)', width: 14 },
        { key: 'source_area', header: 'Source Area', width: 22 },
        { key: 'route_name', header: 'Route', width: 20 },
        { key: 'vehicle_number', header: 'Vehicle', width: 16 },
        { key: 'current_status', header: 'Current Status', width: 14 },
        { key: 'current_stage', header: 'Current Stage', width: 16 },
        { key: 'updated_at', header: 'Last Updated', width: 22 },
      ],
      rows: res.rows,
    };
  }

  if (normDataset === 'audit' || normDataset === 'audit-log' || normDataset === 'audit-logs') {
    const whereClauses = [];
    const params = [];

    if (filters.action && filters.action !== 'ALL') {
      params.push(filters.action);
      whereClauses.push(`al.action = $${params.length}`);
    }

    if (filters.user) {
      params.push(`%${filters.user}%`);
      whereClauses.push(`(u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
    }

    if (filters.batch) {
      params.push(`%${filters.batch}%`);
      whereClauses.push(`b.batch_code ILIKE $${params.length}`);
    }

    if (filters.start_date) {
      params.push(filters.start_date);
      whereClauses.push(`al.performed_at >= $${params.length}`);
    }

    if (filters.end_date) {
      params.push(filters.end_date);
      whereClauses.push(`al.performed_at <= $${params.length}`);
    }

    const limitSql = buildLimitSql(filters, params);
    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const sql = `
      SELECT 
        al.performed_at, al.action, u.name AS user_name, b.batch_code, al.entity_type, al.reason
      FROM audit_log al
      JOIN users u ON u.id = al.performed_by
      LEFT JOIN batches b ON b.id = al.batch_id
      ${whereSql}
      ORDER BY al.performed_at DESC
      ${limitSql}
    `;
    const res = await query(sql, params);
    return {
      name: 'Audit-Log',
      columns: [
        { key: 'performed_at', header: 'Time', width: 22 },
        { key: 'action', header: 'Action', width: 18 },
        { key: 'user_name', header: 'User', width: 18 },
        { key: 'batch_code', header: 'Batch Code', width: 16 },
        { key: 'entity_type', header: 'Entity', width: 16 },
        { key: 'reason', header: 'Reason', width: 28 },
      ],
      rows: res.rows,
    };
  }

  throw new AppError(
    404,
    ErrorCodes.NOT_FOUND,
    `Unknown dataset '${dataset}'. Allowed: batches, stage-records, full-history, current-status, audit`
  );
}

export async function exportCsv(dataset, filters, res) {
  const data = await fetchDatasetRows(dataset, filters);
  const filename = `${data.name.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const columnsMap = {};
  for (const col of data.columns) {
    columnsMap[col.key] = col.header;
  }

  const stringifier = stringify({
    header: true,
    columns: columnsMap,
  });

  stringifier.pipe(res);

  for (const row of data.rows) {
    stringifier.write(row);
  }
  stringifier.end();
}

export async function exportXlsx(dataset, filters, res) {
  const data = await fetchDatasetRows(dataset, filters);
  const filename = `${data.name.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.xlsx`;

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(data.name);

  worksheet.columns = data.columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width || 18,
  }));

  // Style header row
  worksheet.getRow(1).font = { bold: true };

  for (const row of data.rows) {
    worksheet.addRow(row);
  }

  await workbook.xlsx.write(res);
  res.end();
}
