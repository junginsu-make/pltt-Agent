import { serve } from '@hono/node-server';
import app from './app.js';

const port = 3004;
console.log(`[scheduler] Starting on port ${port}...`);

serve({ fetch: app.fetch, port });
