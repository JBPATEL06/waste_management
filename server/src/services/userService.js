import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { query } from '../db/index.js';
import { AppError, ErrorCodes } from '../utils/errors.js';
import { logAudit } from './auditService.js';
import { invalidateUserCache } from './userCache.js';

function generateTempPassword() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%^&*';
  // Ensure at least one letter, one digit, one symbol
  let pwd = [
    letters.charAt(crypto.randomInt(letters.length)),
    digits.charAt(crypto.randomInt(digits.length)),
    symbols.charAt(crypto.randomInt(symbols.length)),
  ];
  const allChars = letters + digits + symbols;
  while (pwd.length < 10) {
    pwd.push(allChars.charAt(crypto.randomInt(allChars.length)));
  }
  // Shuffle
  return pwd.sort(() => Math.random() - 0.5).join('');
}

export async function getMe(userId) {
  const userRes = await query(
    `SELECT id, name, email, role, is_active, must_change_password, last_login_at, created_at 
     FROM users 
     WHERE id = $1`,
    [userId]
  );

  if (userRes.rows.length === 0) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, 'User not found');
  }

  const user = userRes.rows[0];
  let stageCounts = null;

  const stageRoles = ['COLLECTION', 'TRANSPORTATION', 'RTS', 'PROCESSING'];
  if (stageRoles.includes(user.role)) {
    // Count active assignments for this user
    const statsRes = await query(
      `SELECT 
         COUNT(*) FILTER (WHERE se.id IS NOT NULL) AS submitted_count,
         COUNT(*) FILTER (WHERE se.id IS NULL AND b.current_status != 'COMPLETED') AS ready_or_locked_count
       FROM batch_assignments ba
       JOIN batches b ON b.id = ba.batch_id
       LEFT JOIN stage_entries se ON se.batch_id = ba.batch_id 
                                 AND se.stage = ba.stage 
                                 AND se.status = 'ACTIVE'
       WHERE ba.user_id = $1 AND ba.is_active = true`,
      [userId]
    );

    stageCounts = {
      submittedCount: Number(statsRes.rows[0]?.submitted_count || 0),
      readyCount: Number(statsRes.rows[0]?.ready_or_locked_count || 0),
      lockedCount: 0,
    };
  }

  return {
    ...user,
    stageCounts,
  };
}

export async function updateMe(userId, { name }) {
  const result = await query(
    `UPDATE users 
     SET name = $1, updated_at = now() 
     WHERE id = $2 
     RETURNING id, name, email, role, is_active, must_change_password, last_login_at`,
    [name, userId]
  );

  if (result.rows.length === 0) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, 'User not found');
  }

  invalidateUserCache(userId);
  return result.rows[0];
}

export async function listUsers({ role, status, search, limit = 50, offset = 0 }) {
  let whereClauses = [];
  let params = [];

  if (role) {
    params.push(role);
    whereClauses.push(`role = $${params.length}`);
  }

  if (status === 'active') {
    whereClauses.push(`is_active = true`);
  } else if (status === 'inactive') {
    whereClauses.push(`is_active = false`);
  }

  if (search) {
    params.push(`%${search}%`);
    whereClauses.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length})`);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countQuery = `SELECT count(*) FROM users ${whereSql}`;
  const totalRes = await query(countQuery, params);
  const total = Number(totalRes.rows[0].count);

  params.push(limit);
  const limitParam = `$${params.length}`;
  params.push(offset);
  const offsetParam = `$${params.length}`;

  const listQuery = `
    SELECT id, name, email, role, is_active, must_change_password, last_login_at, created_at, updated_at
    FROM users
    ${whereSql}
    ORDER BY created_at DESC
    LIMIT ${limitParam} OFFSET ${offsetParam}
  `;

  const rowsRes = await query(listQuery, params);

  return {
    users: rowsRes.rows,
    total,
    limit,
    offset,
  };
}

export async function getUserById(id) {
  const result = await query(
    `SELECT id, name, email, role, is_active, must_change_password, last_login_at, created_at, updated_at
     FROM users
     WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, 'User not found');
  }

  return result.rows[0];
}

export async function createUser({ name, email, role, adminId }) {
  // Check if email already exists
  const existing = await query(`SELECT id FROM users WHERE email = $1`, [email]);
  if (existing.rows.length > 0) {
    throw new AppError(409, ErrorCodes.ENTRY_EXISTS, 'A user with this email address already exists');
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const result = await query(
    `INSERT INTO users (
       name, email, password_hash, role, is_active, must_change_password, created_by
     ) VALUES ($1, $2, $3, $4, true, true, $5)
     RETURNING id, name, email, role, is_active, must_change_password, created_at`,
    [name, email, passwordHash, role, adminId]
  );

  const createdUser = result.rows[0];

  // Write audit log
  await logAudit({
    action: 'USER_CREATE',
    entityType: 'user',
    entityId: createdUser.id,
    newValues: { name, email, role, is_active: true },
    performedBy: adminId,
  });

  return {
    user: createdUser,
    temporaryPassword: tempPassword,
  };
}

export async function updateUser(id, updates, adminId) {
  const current = await getUserById(id);

  let fields = [];
  let params = [id];

  if (updates.name !== undefined) {
    params.push(updates.name);
    fields.push(`name = $${params.length}`);
  }

  if (updates.email !== undefined) {
    // Check conflict
    const existing = await query(`SELECT id FROM users WHERE email = $1 AND id != $2`, [updates.email, id]);
    if (existing.rows.length > 0) {
      throw new AppError(409, ErrorCodes.ENTRY_EXISTS, 'A user with this email address already exists');
    }
    params.push(updates.email);
    fields.push(`email = $${params.length}`);
  }

  if (updates.role !== undefined) {
    params.push(updates.role);
    fields.push(`role = $${params.length}`);
  }

  if (fields.length === 0) {
    return current;
  }

  const sql = `
    UPDATE users 
    SET ${fields.join(', ')}, updated_at = now() 
    WHERE id = $1 
    RETURNING id, name, email, role, is_active, must_change_password, updated_at
  `;

  const result = await query(sql, params);
  const updatedUser = result.rows[0];

  invalidateUserCache(id);

  await logAudit({
    action: 'USER_UPDATE',
    entityType: 'user',
    entityId: id,
    oldValues: current,
    newValues: updatedUser,
    performedBy: adminId,
  });

  return updatedUser;
}

export async function resetPassword(id, adminId) {
  await getUserById(id);

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  await query(
    `UPDATE users 
     SET password_hash = $1, 
         must_change_password = true, 
         updated_at = now() 
     WHERE id = $2`,
    [passwordHash, id]
  );

  // Revoke all existing sessions for this user
  await query(
    `UPDATE refresh_tokens 
     SET revoked_at = now() 
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [id]
  );

  invalidateUserCache(id);

  await logAudit({
    action: 'PASSWORD_RESET',
    entityType: 'user',
    entityId: id,
    newValues: { must_change_password: true },
    reason: 'Admin password reset',
    performedBy: adminId,
  });

  return {
    temporaryPassword: tempPassword,
  };
}

export async function deactivateUser(id, adminId) {
  // Check pending assigned batches
  const pendingCheck = await query(
    `SELECT count(*) AS pending_count 
     FROM batch_assignments ba
     JOIN batches b ON b.id = ba.batch_id
     WHERE ba.user_id = $1 AND ba.is_active = true AND b.current_status != 'COMPLETED'`,
    [id]
  );

  const pendingCount = Number(pendingCheck.rows[0]?.pending_count || 0);
  if (pendingCount > 0) {
    throw new AppError(
      409,
      ErrorCodes.DELETE_BLOCKED,
      `Cannot deactivate user with ${pendingCount} pending assigned batch(es). Please reassign batches first.`
    );
  }

  const result = await query(
    `UPDATE users 
     SET is_active = false, updated_at = now() 
     WHERE id = $1 
     RETURNING id, name, email, role, is_active`,
    [id]
  );

  if (result.rows.length === 0) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, 'User not found');
  }

  // Revoke all refresh tokens immediately
  await query(
    `UPDATE refresh_tokens 
     SET revoked_at = now() 
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [id]
  );

  invalidateUserCache(id);

  await logAudit({
    action: 'USER_DEACTIVATE',
    entityType: 'user',
    entityId: id,
    newValues: { is_active: false },
    performedBy: adminId,
  });

  return result.rows[0];
}

export async function activateUser(id, adminId) {
  const result = await query(
    `UPDATE users 
     SET is_active = true, updated_at = now() 
     WHERE id = $1 
     RETURNING id, name, email, role, is_active`,
    [id]
  );

  if (result.rows.length === 0) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, 'User not found');
  }

  invalidateUserCache(id);

  await logAudit({
    action: 'USER_UPDATE',
    entityType: 'user',
    entityId: id,
    newValues: { is_active: true },
    reason: 'User activated',
    performedBy: adminId,
  });

  return result.rows[0];
}

