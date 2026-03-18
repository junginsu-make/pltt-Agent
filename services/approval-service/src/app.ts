import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { rateLimiter } from '@palette/shared/middleware/rate-limiter';
import { serviceAuthMiddleware } from '@palette/shared/middleware/service-auth';
import approvalRoutes from './routes/approvals.js';
import { errorHandler } from './middleware/error-handler.js';

const app = new Hono();

app.use('*', logger());
app.use('*', cors({
  origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3010', 'http://localhost:3020'],
}));
app.use('*', rateLimiter());

app.get('/health', (c) => c.json({ status: 'ok', service: 'approval-service' }));

app.use('/api/v1/*', serviceAuthMiddleware());

// Mount approval routes
app.route('/api/v1/approvals', approvalRoutes);

// Error handler
app.onError(errorHandler);

export default app;
