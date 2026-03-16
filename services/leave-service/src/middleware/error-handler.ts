import type { Context, Next } from 'hono';

export async function errorHandler(c: Context, next: Next) {
  try {
    await next();
  } catch (err: unknown) {
    const e = err as any;
    if (e && typeof e === 'object' && typeof e.code === 'string' && typeof e.statusCode === 'number') {
      const response = {
        error: {
          code: e.code as string,
          message: e.message as string,
          ...(e.details && { details: e.details }),
        },
      };
      return c.json(response, e.statusCode as 400 | 403 | 409 | 503);
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
}
