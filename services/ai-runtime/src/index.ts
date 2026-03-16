import { serve } from '@hono/node-server';
import app from './app.js';

const port = 3100;
console.log(`[ai-runtime] Starting on port ${port}...`);

serve({ fetch: app.fetch, port });
