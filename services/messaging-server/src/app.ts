import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { rateLimiter } from '@palette/shared/middleware/rate-limiter';
import { errorHandler } from '@palette/shared/middleware/error-handler';
import authRoutes from './routes/auth.js';
import messengerRoutes from './routes/messenger.js';
import { authMiddleware } from './middleware/auth.js';

const app = new Hono();

app.use('*', logger());
app.use('*', cors({
  origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3010', 'http://localhost:3020'],
}));
app.use('*', rateLimiter());

app.get('/health', (c) => c.json({ status: 'ok', service: 'messaging-server' }));

// Auth routes (no middleware)
app.route('/api/v1/auth', authRoutes);

// Messenger routes (with auth)
app.use('/api/v1/messenger/*', authMiddleware);
app.route('/api/v1/messenger', messengerRoutes);

app.onError(errorHandler);

export default app;
