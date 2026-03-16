import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import authRoutes from './routes/auth.js';
import messengerRoutes from './routes/messenger.js';
import { authMiddleware } from './middleware/auth.js';

const app = new Hono();

app.use('*', logger());
app.use('*', cors());

app.get('/health', (c) => c.json({ status: 'ok', service: 'messaging-server' }));

// Auth routes (no middleware)
app.route('/api/v1/auth', authRoutes);

// Messenger routes (with auth)
app.use('/api/v1/messenger/*', authMiddleware);
app.route('/api/v1/messenger', messengerRoutes);

export default app;
