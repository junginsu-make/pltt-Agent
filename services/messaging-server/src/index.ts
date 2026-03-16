import { serve } from '@hono/node-server';
import { Server } from 'socket.io';
import app from './app.js';
import { initSocketServer } from './socket/index.js';

const port = Number(process.env.PORT ?? 3000);

console.log(`[messaging-server] Starting on port ${port}...`);

const server = serve({ fetch: app.fetch, port });

const io = new Server(server, {
  cors: { origin: '*' },
});

initSocketServer(io);

console.log(`[messaging-server] Started on port ${port}`);
