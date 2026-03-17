import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

const app = new Hono();

app.use('*', logger());
app.use('*', cors({
  origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3010', 'http://localhost:3020'],
}));

app.get('/health', (c) => c.json({ status: 'ok', service: 'notification-service' }));

export default app;
