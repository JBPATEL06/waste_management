import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { query } from '../db/index.js';
import { AppError, ErrorCodes } from '../utils/errors.js';
import {
  generateRawRefreshToken,
  hashRefreshToken,
  signAccessToken,
} from '../utils/tokens.js';
import { logAudit } from './auditService.js';
import { invalidateUserCache } from './userCache.js';

// Dummy hash used for constant-time comparison against nonexistent users
const DUMMY_HASH = '$2a$12$e80y6jZ6b1cWc07o8kZ43O6R66I656O656O656O656O656O656O65';

export async function login({ email, password, userAgent = null, ipAddress = null }) {
  const result = await query(
    `SELECT id, name, email, password_hash, role, is_active, must_change_password, 
            failed_login_count, locked_until 
     FROM users 
     WHERE email = $1`,
    [email]
  );

  if (result.rows.length === 0) {
    await bcrypt.compare(password, DUMMY_HASH);
    throw new AppError(401, ErrorCodes.INVALID_CREDENTIALS, 'Invalid email or password');
  }

  const user = result.rows[0];

  // Check account lockout
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const minutesLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
    throw new AppError(
      423,
      ErrorCodes.ACCOUNT_LOCKED,
      `Account locked due to consecutive failed attempts. Please wait ${minutesLeft} minute(s).`
    );
  }

  // Check if deactivated
  if (!user.is_active) {
    throw new AppError(401, ErrorCodes.INVALID_CREDENTIALS, 'Invalid email or password');
  }

  // Verify password with bcrypt
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    const nextFailedCount = (user.failed_login_count || 0) + 1;
    if (nextFailedCount >= 5) {
      await query(
        `UPDATE users 
         SET failed_login_count = $1, 
             locked_until = now() + INTERVAL '15 minutes' 
         WHERE id = $2`,
        [nextFailedCount, user.id]
      );
      throw new AppError(
        423,
        ErrorCodes.ACCOUNT_LOCKED,
        'Account locked for 15 minutes due to 5 consecutive failed login attempts.'
      );
    } else {
      await query(
        `UPDATE users 
         SET failed_login_count = $1 
         WHERE id = $2`,
        [nextFailedCount, user.id]
      );
    }
    throw new AppError(401, ErrorCodes.INVALID_CREDENTIALS, 'Invalid email or password');
  }

  // Login successful: reset failed counters and update last login
  await query(
    `UPDATE users 
     SET failed_login_count = 0, 
         locked_until = NULL, 
         last_login_at = now() 
     WHERE id = $1`,
    [user.id]
  );

  // Generate tokens
  const accessToken = signAccessToken(user);
  const rawRefreshToken = generateRawRefreshToken();
  const tokenHash = hashRefreshToken(rawRefreshToken);
  const familyId = crypto.randomUUID();

  await query(
    `INSERT INTO refresh_tokens (
       user_id, token_hash, family_id, expires_at, user_agent, ip_address
     ) VALUES ($1, $2, $3, now() + INTERVAL '7 days', $4, $5)`,
    [user.id, tokenHash, familyId, userAgent, ipAddress]
  );

  return {
    accessToken,
    rawRefreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      must_change_password: user.must_change_password,
    },
  };
}

export async function refresh({ rawRefreshToken, userAgent = null, ipAddress = null }) {
  if (!rawRefreshToken) {
    throw new AppError(401, ErrorCodes.TOKEN_INVALID, 'Refresh token is required');
  }

  const tokenHash = hashRefreshToken(rawRefreshToken);
  const tokenRes = await query(
    `SELECT id, user_id, family_id, expires_at, revoked_at 
     FROM refresh_tokens 
     WHERE token_hash = $1`,
    [tokenHash]
  );

  if (tokenRes.rows.length === 0) {
    throw new AppError(401, ErrorCodes.TOKEN_INVALID, 'Invalid refresh token');
  }

  const tokenRecord = tokenRes.rows[0];

  // Token reuse detection: if already revoked, revoke all tokens in family
  if (tokenRecord.revoked_at) {
    await query(
      `UPDATE refresh_tokens 
       SET revoked_at = now() 
       WHERE family_id = $1 AND revoked_at IS NULL`,
      [tokenRecord.family_id]
    );
    throw new AppError(
      401,
      ErrorCodes.TOKEN_INVALID,
      'Session invalid due to token reuse detection. Please log in again.'
    );
  }

  // Check expiration
  if (new Date(tokenRecord.expires_at) <= new Date()) {
    throw new AppError(401, ErrorCodes.TOKEN_EXPIRED, 'Refresh token has expired. Please log in again.');
  }

  // Fetch active user
  const userRes = await query(
    `SELECT id, name, email, role, is_active, must_change_password 
     FROM users 
     WHERE id = $1`,
    [tokenRecord.user_id]
  );

  if (userRes.rows.length === 0 || !userRes.rows[0].is_active) {
    throw new AppError(401, ErrorCodes.TOKEN_INVALID, 'User account is inactive or not found');
  }

  const user = userRes.rows[0];

  // Rotate token: revoke current and insert new child in same family
  await query(
    `UPDATE refresh_tokens 
     SET revoked_at = now() 
     WHERE id = $1`,
    [tokenRecord.id]
  );

  const newRawRefreshToken = generateRawRefreshToken();
  const newTokenHash = hashRefreshToken(newRawRefreshToken);

  await query(
    `INSERT INTO refresh_tokens (
       user_id, token_hash, family_id, expires_at, user_agent, ip_address
     ) VALUES ($1, $2, $3, now() + INTERVAL '7 days', $4, $5)`,
    [user.id, newTokenHash, tokenRecord.family_id, userAgent, ipAddress]
  );

  const accessToken = signAccessToken(user);

  return {
    accessToken,
    rawRefreshToken: newRawRefreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      must_change_password: user.must_change_password,
    },
  };
}

export async function logout({ rawRefreshToken }) {
  if (!rawRefreshToken) return;
  const tokenHash = hashRefreshToken(rawRefreshToken);
  await query(
    `UPDATE refresh_tokens 
     SET revoked_at = now() 
     WHERE token_hash = $1 AND revoked_at IS NULL`,
    [tokenHash]
  );
}

export async function logoutAll({ userId }) {
  await query(
    `UPDATE refresh_tokens 
     SET revoked_at = now() 
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
  invalidateUserCache(userId);
}

export async function changePassword({ userId, currentPassword, newPassword, userAgent = null, ipAddress = null }) {
  const result = await query(
    `SELECT id, name, email, role, password_hash 
     FROM users 
     WHERE id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    throw new AppError(404, ErrorCodes.NOT_FOUND, 'User not found');
  }

  const user = result.rows[0];
  const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isMatch) {
    throw new AppError(401, ErrorCodes.INVALID_CREDENTIALS, 'Current password is incorrect');
  }

  // Hash new password using bcrypt cost 12
  const newHash = await bcrypt.hash(newPassword, 12);

  await query(
    `UPDATE users 
     SET password_hash = $1, 
         must_change_password = false, 
         updated_at = now() 
     WHERE id = $2`,
    [newHash, userId]
  );

  // Invalidate cache
  invalidateUserCache(userId);

  // Revoke all existing refresh tokens
  await query(
    `UPDATE refresh_tokens 
     SET revoked_at = now() 
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );

  // Write audit log
  await logAudit({
    action: 'PASSWORD_RESET',
    entityType: 'user',
    entityId: userId,
    oldValues: { must_change_password: true },
    newValues: { must_change_password: false },
    reason: 'User self password change',
    performedBy: userId,
  });

  // Issue fresh session
  const accessToken = signAccessToken({ ...user, role: user.role });
  const rawRefreshToken = generateRawRefreshToken();
  const tokenHash = hashRefreshToken(rawRefreshToken);
  const familyId = crypto.randomUUID();

  await query(
    `INSERT INTO refresh_tokens (
       user_id, token_hash, family_id, expires_at, user_agent, ip_address
     ) VALUES ($1, $2, $3, now() + INTERVAL '7 days', $4, $5)`,
    [userId, tokenHash, familyId, userAgent, ipAddress]
  );

  return {
    accessToken,
    rawRefreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      must_change_password: false,
    },
  };
}

