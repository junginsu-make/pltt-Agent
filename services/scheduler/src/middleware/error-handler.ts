import type { Context } from 'hono';
import { AppError } from '@palette/shared';

export function errorHandler(err: Error, c: Context) {
  if (err instanceof AppError) {
    return c.json(err.toResponse(), err.statusCode as 400 | 403 | 404 | 409 | 503);
  }

  console.error('[scheduler] Unhandled error:', err);

  return c.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: '내부 서버 오류가 발생했습니다',
      },
    },
    500,
  );
}
