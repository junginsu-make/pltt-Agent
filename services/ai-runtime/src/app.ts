import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import runtimeRoutes from './routes/runtime.js';

const app = new Hono();

app.use('*', logger());
app.use('*', cors());

app.get('/health', (c) => c.json({ status: 'ok', service: 'ai-runtime' }));
app.route('/api/v1/runtime', runtimeRoutes);

export default app;
