import type { Context } from 'hono';
import { AppError } from '../errors/index.js';

export function errorHandler(err: Error, c: Context): Response {
  if (err instanceof AppError) {
    return c.json(err.toResponse(), err.statusCode as 400 | 401 | 403 | 404 | 409 | 503);
  }

  // Duck-type check for AppError-like objects (e.g. from other packages)
  const e = err as Record<string, unknown>;
  if (typeof e.code === 'string' && typeof e.statusCode === 'number') {
    return c.json(
      {
        error: {
          code: e.code,
          message: e.message,
          ...((e.details) && { details: e.details }),
        },
      },
      e.statusCode as 400 | 401 | 403 | 404 | 409 | 503,
    );
  }

  console.error('Unexpected error:', err);
  return c.json(
    {
      error: {
        code: 'SYS_001',
        message: '잠시 후 재시도해주세요',
      },
    },
    500,
  );
}
