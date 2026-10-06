import { AppError, ErrorCodes } from '../utils/errors.js';

export function errorHandler(err, req, res, next) {
  // If response has already been sent, delegate to default Express handler
  if (res.headersSent) {
    return next(err);
  }

  // AppError (our custom domain errors)
  if (err instanceof AppError) {
    const response = {
      error: {
        code: err.code,
        message: err.message,
      },
    };
    if (err.details) {
      response.error.details = err.details;
    }
    return res.status(err.statusCode).json(response);
  }

  // Zod validation errors
  if (err.name === 'ZodError') {
    const details = err.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    return res.status(422).json({
      error: {
        code: ErrorCodes.VALIDATION_FAILED,
        message: 'Validation failed for request data',
        details,
      },
    });
  }

  // Postgres unique constraint violation
  if (err.code === '23505') {
    return res.status(409).json({
      error: {
        code: ErrorCodes.ENTRY_EXISTS,
        message: 'A duplicate record with unique properties already exists.',
        details: err.detail,
      },
    });
  }

  // Postgres foreign key constraint violation
  if (err.code === '23503') {
    return res.status(409).json({
      error: {
        code: ErrorCodes.DELETE_BLOCKED,
        message: 'Operation blocked because this record is referenced by other system records.',
        details: err.detail,
      },
    });
  }

  // Log unhandled server errors
  console.error('Unhandled Server Error:', err);

  return res.status(500).json({
    error: {
      code: ErrorCodes.INTERNAL_SERVER_ERROR,
      message: 'An internal server error occurred.',
    },
  });
}

