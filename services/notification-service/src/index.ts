import { serve } from '@hono/node-server';
import app from './app.js';

const port = 3003;
console.log(`[notification-service] Starting on port ${port}...`);

serve({ fetch: app.fetch, port });
