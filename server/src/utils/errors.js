/**
 * Standard error codes per data_dictionary_and_auth.md §B9
 */
export const ErrorCodes = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  FORBIDDEN_ROLE: 'FORBIDDEN_ROLE',
  NOT_ASSIGNED: 'NOT_ASSIGNED',
  PASSWORD_CHANGE_REQUIRED: 'PASSWORD_CHANGE_REQUIRED',
  NOT_FOUND: 'NOT_FOUND',
  STAGE_LOCKED: 'STAGE_LOCKED',
  ENTRY_EXISTS: 'ENTRY_EXISTS',
  DELETE_BLOCKED: 'DELETE_BLOCKED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
};

export class AppError extends Error {
  constructor(statusCode, code, message, details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

