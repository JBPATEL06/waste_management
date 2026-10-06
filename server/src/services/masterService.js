import { query } from '../db/index.js';
import { AppError, ErrorCodes } from '../utils/errors.js';
import {
  createDriverSchema,
  createNameLocationSchema,
  createNameOnlySchema,
  createRouteSchema,
  createVehicleSchema,
  updateDriverSchema,
  updateNameLocationSchema,
  updateNameOnlySchema,
  updateRouteSchema,
  updateVehicleSchema,
} from '../validators/masterValidators.js';
import { logAudit } from './auditService.js';

const MASTER_CONFIG = {
  routes: {
    table: 'routes',
    createSchema: createRouteSchema,
    updateSchema: updateRouteSchema,
    columns: ['code', 'name', 'description'],
    checkUsageQuery: `
      SELECT (
        (SELECT count(*) FROM batches WHERE route_id = $1) + 
        (SELECT count(*) FROM collection_details WHERE route_id = $1)
      ) AS count
    `,
  },
  vehicles: {
    table: 'vehicles',
    createSchema: createVehicleSchema,
    updateSchema: updateVehicleSchema,
    columns: ['vehicle_number', 'vehicle_type', 'capacity_kg'],
    checkUsageQuery: `
      SELECT (
        (SELECT count(*) FROM batches WHERE vehicle_id = $1) + 
        (SELECT count(*) FROM collection_details WHERE vehicle_id = $1) + 
        (SELECT count(*) FROM transportation_details WHERE vehicle_id = $1)
      ) AS count
    `,
  },
  rts_locations: {
    table: 'rts_locations',
    createSchema: createNameLocationSchema,
    updateSchema: updateNameLocationSchema,
    columns: ['name', 'location'],
    checkUsageQuery: `
      SELECT (
        (SELECT count(*) FROM transportation_details WHERE rts_location_id = $1) + 
        (SELECT count(*) FROM rts_details WHERE rts_location_id = $1)
      ) AS count
    `,
  },
  'rts-locations': {
    table: 'rts_locations',
    createSchema: createNameLocationSchema,
    updateSchema: updateNameLocationSchema,
    columns: ['name', 'location'],
    checkUsageQuery: `
      SELECT (
        (SELECT count(*) FROM transportation_details WHERE rts_location_id = $1) + 
        (SELECT count(*) FROM rts_details WHERE rts_location_id = $1)
      ) AS count
    `,
  },
  processing_facilities: {
    table: 'processing_facilities',
    createSchema: createNameLocationSchema,
    updateSchema: updateNameLocationSchema,
    columns: ['name', 'location'],
    checkUsageQuery: `
      SELECT (
        (SELECT count(*) FROM rts_details WHERE next_facility_id = $1) + 
        (SELECT count(*) FROM processing_details WHERE facility_id = $1)
      ) AS count
    `,
  },
  'processing-facilities': {
    table: 'processing_facilities',
    createSchema: createNameLocationSchema,
    updateSchema: updateNameLocationSchema,
    columns: ['name', 'location'],
    checkUsageQuery: `
      SELECT (
        (SELECT count(*) FROM rts_details WHERE next_facility_id = $1) + 
        (SELECT count(*) FROM processing_details WHERE facility_id = $1)
      ) AS count
    `,
  },
  process_types: {
    table: 'process_types',
    createSchema: createNameOnlySchema,
    updateSchema: updateNameOnlySchema,
    columns: ['name'],
    checkUsageQuery: `SELECT count(*) AS count FROM processing_details WHERE process_type_id = $1`,
  },
  'process-types': {
    table: 'process_types',
    createSchema: createNameOnlySchema,
    updateSchema: updateNameOnlySchema,
    columns: ['name'],
    checkUsageQuery: `SELECT count(*) AS count FROM processing_details WHERE process_type_id = $1`,
  },
  waste_categories: {
    table: 'waste_categories',
    createSchema: createNameOnlySchema,
    updateSchema: updateNameOnlySchema,
    columns: ['name'],
    checkUsageQuery: `SELECT count(*) AS count FROM rts_details WHERE waste_category_id = $1`,
  },
  'waste-categories': {
    table: 'waste_categories',
    createSchema: createNameOnlySchema,
    updateSchema: updateNameOnlySchema,
    columns: ['name'],
    checkUsageQuery: `SELECT count(*) AS count FROM rts_details WHERE waste_category_id = $1`,
  },
  drivers: {
    table: 'drivers',
    createSchema: createDriverSchema,
    updateSchema: updateDriverSchema,
    columns: ['name', 'phone', 'designation'],
    checkUsageQuery: `SELECT count(*) AS count FROM collection_details WHERE driver_id = $1`,
  },
};

function getMasterConfig(type) {
  const conf = MASTER_CONFIG[type];
  if (!conf) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, `Invalid master data type: ${type}`);
  }
  return conf;
}

export async function listMaster(type, { includeInactive = false }) {
  const { table } = getMasterConfig(type);
  const whereSql = includeInactive ? '' : 'WHERE is_active = true';
  const result = await query(
    `SELECT * FROM ${table} ${whereSql} ORDER BY created_at ASC`
  );
  return result.rows;
}

export async function createMaster(type, data, adminId) {
  const conf = getMasterConfig(type);
  const validated = await conf.createSchema.parseAsync(data);

  // Check unique constraints for names / codes
  if (validated.code) {
    const existingCode = await query(`SELECT id FROM ${conf.table} WHERE code = $1`, [validated.code]);
    if (existingCode.rows.length > 0) {
      throw new AppError(409, ErrorCodes.ENTRY_EXISTS, `A record with code '${validated.code}' already exists`);
    }
  }

  if (validated.vehicle_number) {
    const existingVeh = await query(`SELECT id FROM ${conf.table} WHERE vehicle_number = $1`, [validated.vehicle_number]);
    if (existingVeh.rows.length > 0) {
      throw new AppError(409, ErrorCodes.ENTRY_EXISTS, `Vehicle number '${validated.vehicle_number}' already exists`);
    }
  }

  if (validated.name && conf.table !== 'drivers') {
    const existingName = await query(`SELECT id FROM ${conf.table} WHERE name = $1`, [validated.name]);
    if (existingName.rows.length > 0) {
      throw new AppError(409, ErrorCodes.ENTRY_EXISTS, `A record with name '${validated.name}' already exists`);
    }
  }

  const cols = [];
  const placeholders = [];
  const values = [];

  for (const col of conf.columns) {
    if (validated[col] !== undefined) {
      cols.push(col);
      values.push(validated[col]);
      placeholders.push(`$${values.length}`);
    }
  }

  cols.push('is_active');
  values.push(true);
  placeholders.push(`$${values.length}`);

  const insertSql = `
    INSERT INTO ${conf.table} (${cols.join(', ')}) 
    VALUES (${placeholders.join(', ')}) 
    RETURNING *
  `;

  const result = await query(insertSql, values);
  const created = result.rows[0];

  await logAudit({
    action: 'MASTER_CHANGE',
    entityType: conf.table,
    entityId: created.id,
    newValues: created,
    reason: `Created master item in ${conf.table}`,
    performedBy: adminId,
  });

  return created;
}

export async function updateMaster(type, id, data, adminId) {
  const conf = getMasterConfig(type);
  const validated = await conf.updateSchema.parseAsync(data);

  const currentRes = await query(`SELECT * FROM ${conf.table} WHERE id = $1`, [id]);
  if (currentRes.rows.length === 0) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, 'Record not found');
  }
  const current = currentRes.rows[0];

  // Unique checks excluding current id
  if (validated.code) {
    const existing = await query(`SELECT id FROM ${conf.table} WHERE code = $1 AND id != $2`, [validated.code, id]);
    if (existing.rows.length > 0) {
      throw new AppError(409, ErrorCodes.ENTRY_EXISTS, `A record with code '${validated.code}' already exists`);
    }
  }

  if (validated.vehicle_number) {
    const existing = await query(`SELECT id FROM ${conf.table} WHERE vehicle_number = $1 AND id != $2`, [validated.vehicle_number, id]);
    if (existing.rows.length > 0) {
      throw new AppError(409, ErrorCodes.ENTRY_EXISTS, `Vehicle number '${validated.vehicle_number}' already exists`);
    }
  }

  if (validated.name && conf.table !== 'drivers') {
    const existing = await query(`SELECT id FROM ${conf.table} WHERE name = $1 AND id != $2`, [validated.name, id]);
    if (existing.rows.length > 0) {
      throw new AppError(409, ErrorCodes.ENTRY_EXISTS, `A record with name '${validated.name}' already exists`);
    }
  }

  const setClauses = [];
  const values = [id];

  const updatableCols = [...conf.columns, 'is_active'];
  for (const col of updatableCols) {
    if (validated[col] !== undefined) {
      values.push(validated[col]);
      setClauses.push(`${col} = $${values.length}`);
    }
  }

  if (setClauses.length === 0) {
    return current;
  }

  const updateSql = `
    UPDATE ${conf.table} 
    SET ${setClauses.join(', ')}, updated_at = now() 
    WHERE id = $1 
    RETURNING *
  `;

  const result = await query(updateSql, values);
  const updated = result.rows[0];

  await logAudit({
    action: 'MASTER_CHANGE',
    entityType: conf.table,
    entityId: id,
    oldValues: current,
    newValues: updated,
    reason: `Updated master item in ${conf.table}`,
    performedBy: adminId,
  });

  return updated;
}

export async function deleteMaster(type, id, adminId) {
  const conf = getMasterConfig(type);

  const currentRes = await query(`SELECT * FROM ${conf.table} WHERE id = $1`, [id]);
  if (currentRes.rows.length === 0) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, 'Record not found');
  }
  const current = currentRes.rows[0];

  // Check if referenced anywhere
  const usageRes = await query(conf.checkUsageQuery, [id]);
  const usageCount = Number(usageRes.rows[0]?.count || 0);

  if (usageCount > 0) {
    throw new AppError(
      409,
      ErrorCodes.DELETE_BLOCKED,
      `Cannot hard delete this ${conf.table} record because it is referenced in ${usageCount} existing entry/batch record(s). Deactivate instead.`
    );
  }

  await query(`DELETE FROM ${conf.table} WHERE id = $1`, [id]);

  await logAudit({
    action: 'MASTER_CHANGE',
    entityType: conf.table,
    entityId: id,
    oldValues: current,
    newValues: null,
    reason: `Deleted unused master item in ${conf.table}`,
    performedBy: adminId,
  });

  return { message: 'Master record deleted successfully' };
}

