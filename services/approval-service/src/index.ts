import { config } from "dotenv";
config({ path: new URL("../../../.env", import.meta.url).pathname });
import { serve } from '@hono/node-server';
import app from './app.js';

const port = 3002;
console.log(`[approval-service] Starting on port ${port}...`);

serve({ fetch: app.fetch, port });
