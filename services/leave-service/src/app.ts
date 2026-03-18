import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { rateLimiter } from '@palette/shared/middleware/rate-limiter';
import { serviceAuthMiddleware } from '@palette/shared/middleware/service-auth';
import leaveRoutes from './routes/leave.js';
import employeeRoutes from './routes/employees.js';
import leavePolicyRoutes from './routes/leave-policies.js';

const app = new Hono();

app.use('*', logger());
app.use('*', cors({
  origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3010', 'http://localhost:3020'],
}));
app.use('*', rateLimiter());

app.get('/health', (c) => c.json({ status: 'ok', service: 'leave-service' }));

app.use('/api/v1/*', serviceAuthMiddleware());

app.route('/api/v1/leave', leaveRoutes);
app.route('/api/v1/employees', employeeRoutes);
app.route('/api/v1/leave-policies', leavePolicyRoutes);

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
