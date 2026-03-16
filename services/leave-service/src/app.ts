import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import leaveRoutes from './routes/leave.js';

const app = new Hono();

app.use('*', logger());
app.use('*', cors());

app.get('/health', (c) => c.json({ status: 'ok', service: 'leave-service' }));

app.route('/api/v1/leave', leaveRoutes);

// Global error handler using Hono's onError
app.onError((err, c) => {
  const e = err as any;
  if (typeof e.code === 'string' && typeof e.statusCode === 'number') {
    return c.json(
      {
        error: {
          code: e.code,
          message: e.message,
          ...(e.details && { details: e.details }),
        },
      },
      e.statusCode,
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
});

export default app;
