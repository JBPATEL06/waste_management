import { query } from '../db/index.js';
import { getCachedUserStatus } from '../services/userCache.js';
import { AppError, ErrorCodes } from '../utils/errors.js';
import { verifyAccessToken } from '../utils/tokens.js';

/**
 * Verifies JWT access token, checks active status (with 30s cache),
 * and enforces PASSWORD_CHANGE_REQUIRED for users with must_change_password=true.
 */
export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError(401, ErrorCodes.TOKEN_INVALID, 'Authentication token missing or invalid'));
    }

    const token = authHeader.substring(7).trim();
    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new AppError(401, ErrorCodes.TOKEN_EXPIRED, 'Access token has expired'));
      }
      return next(new AppError(401, ErrorCodes.TOKEN_INVALID, 'Invalid access token'));
    }

    const user = await getCachedUserStatus(payload.sub);
    if (!user || !user.isActive) {
      return next(new AppError(401, ErrorCodes.TOKEN_INVALID, 'User account is deactivated or not found'));
    }

    // Check must_change_password policy:
    // "must_change_password blocks all APIs except change-password and logout (PASSWORD_CHANGE_REQUIRED)"
    const url = req.originalUrl || req.url;
    const isAllowedPasswordChangeUrl =
      url.includes('/auth/change-password') ||
      url.includes('/auth/logout') ||
      url.includes('/auth/logout-all');

    if (user.mustChangePassword && !isAllowedPasswordChangeUrl) {
      return next(
        new AppError(
          403,
          ErrorCodes.PASSWORD_CHANGE_REQUIRED,
          'Temporary password detected. Password change required before accessing other resources.'
        )
      );
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Restricts endpoint to specified user_roles.
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError(401, ErrorCodes.TOKEN_INVALID, 'Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          403,
          ErrorCodes.FORBIDDEN_ROLE,
          `Access denied. Role '${req.user.role}' is not authorized to access this resource.`
        )
      );
    }

    next();
  };
}

/**
 * Enforces that stage operators can only interact with batches assigned to them for their active stage.
 * Admin bypasses this check.
 */
export async function requireAssignment(req, res, next) {
  try {
    if (!req.user) {
      return next(new AppError(401, ErrorCodes.TOKEN_INVALID, 'Authentication required'));
    }

    // Admin bypasses assignment checks
    if (req.user.role === 'ADMIN') {
      return next();
    }

    const batchId = req.params.batchId || req.params.id;
    if (!batchId) {
      return next();
    }

    const stage = req.user.role; // COLLECTION, TRANSPORTATION, RTS, PROCESSING
    const result = await query(
      `SELECT id FROM batch_assignments 
       WHERE batch_id = $1 AND stage = $2 AND user_id = $3 AND is_active = true`,
      [batchId, stage, req.user.id]
    );

    if (result.rows.length === 0) {
      return next(
        new AppError(
          403,
          ErrorCodes.NOT_ASSIGNED,
          `You are not the active assignee for batch ${batchId} at the ${stage} stage.`
        )
      );
    }

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Stage guard enforcing valid sequential transitions between stages:
 * - COLLECTION: initial stage, no prior stage required.
 * - TRANSPORTATION: requires active COLLECTION stage entry.
 * - RTS: requires active TRANSPORTATION stage entry with arrival_time present.
 * - PROCESSING: requires active RTS stage entry.
 */
export async function stageGuard(req, res, next) {
  try {
    const batchId = req.params.batchId || req.params.id;
    if (!batchId) {
      return next();
    }

    // Target stage: if stage operator, it's their role; if admin, from body or params
    const stage = req.user.role !== 'ADMIN' ? req.user.role : req.body.stage;
    if (!stage) {
      return next();
    }

    // Check if ACTIVE entry already exists for this stage
    const existingActive = await query(
      `SELECT id FROM stage_entries WHERE batch_id = $1 AND stage = $2 AND status = 'ACTIVE'`,
      [batchId, stage]
    );
    if (existingActive.rows.length > 0) {
      return next(
        new AppError(
          409,
          ErrorCodes.ENTRY_EXISTS,
          `An active entry for stage ${stage} already exists on this batch. Please use the correction flow.`
        )
      );
    }

    if (stage === 'COLLECTION') {
      return next();
    }

    if (stage === 'TRANSPORTATION') {
      const collCheck = await query(
        `SELECT id FROM stage_entries WHERE batch_id = $1 AND stage = 'COLLECTION' AND status = 'ACTIVE'`,
        [batchId]
      );
      if (collCheck.rows.length === 0) {
        return next(new AppError(409, ErrorCodes.STAGE_LOCKED, 'Collection stage must be completed first'));
      }
      return next();
    }

    if (stage === 'RTS') {
      const transCheck = await query(
        `SELECT se.id, td.arrival_time 
         FROM stage_entries se 
         JOIN transportation_details td ON td.entry_id = se.id 
         WHERE se.batch_id = $1 AND se.stage = 'TRANSPORTATION' AND se.status = 'ACTIVE'`,
        [batchId]
      );
      if (transCheck.rows.length === 0) {
        return next(new AppError(409, ErrorCodes.STAGE_LOCKED, 'Transportation stage must be completed first'));
      }
      if (!transCheck.rows[0].arrival_time) {
        return next(
          new AppError(
            409,
            ErrorCodes.STAGE_LOCKED,
            'Transportation arrival time must be recorded before RTS entry can be created'
          )
        );
      }
      return next();
    }

    if (stage === 'PROCESSING') {
      const rtsCheck = await query(
        `SELECT id FROM stage_entries WHERE batch_id = $1 AND stage = 'RTS' AND status = 'ACTIVE'`,
        [batchId]
      );
      if (rtsCheck.rows.length === 0) {
        return next(new AppError(409, ErrorCodes.STAGE_LOCKED, 'RTS stage must be completed first'));
      }
      return next();
    }

    next();
  } catch (err) {
    next(err);
  }
}

