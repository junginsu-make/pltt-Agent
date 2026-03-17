import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { rateLimiter } from '@palette/shared/middleware/rate-limiter.js';
import { errorHandler } from '@palette/shared/middleware/error-handler.js';
import runtimeRoutes from './routes/runtime.js';

const app = new Hono();

app.use('*', logger());
app.use('*', cors({
  origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3010', 'http://localhost:3020'],
}));
app.use('*', rateLimiter());

app.get('/health', (c) => c.json({ status: 'ok', service: 'ai-runtime' }));
app.route('/api/v1/runtime', runtimeRoutes);

app.onError(errorHandler);

export default app;
