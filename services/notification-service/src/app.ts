import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { rateLimiter } from '@palette/shared/middleware/rate-limiter';
import { AppError } from '@palette/shared/errors/index';
import notificationRoutes from './routes/notifications.js';

const app = new Hono();

app.use('*', logger());
app.use('*', cors({
  origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3010', 'http://localhost:3020'],
}));
app.use('*', rateLimiter());

app.get('/health', (c) => c.json({ status: 'ok', service: 'notification-service' }));

app.route('/api/v1/notifications', notificationRoutes);

// Global error handler
app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json(err.toResponse(), err.statusCode as 400 | 401 | 403 | 404 | 409 | 503);
  }

  console.error('[notification-service] Unhandled error:', err);

  return c.json(
    {
      error: {
        code: 'SYS_001',
        message: '알 수 없는 오류가 발생했습니다',
      },
    },
    500,
  );
});

// 404 handler
app.notFound((c) =>
  c.json(
    {
      error: {
        code: 'NOT_FOUND',
        message: '요청한 리소스를 찾을 수 없습니다',
      },
    },
    404,
  ),
);

export default app;
