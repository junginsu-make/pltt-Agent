import { serve } from '@hono/node-server';
import app from './app.js';
import { getJobRunner } from './jobs/job-runner.js';
import { createAutoApprovalJob } from './jobs/auto-approval.js';
import { createLeaveAccrualJob } from './jobs/leave-accrual.js';

const port = 3004;

// ─── Register Jobs ───────────────────────────────────────────────────────────

const runner = getJobRunner();
runner.register(createAutoApprovalJob());
runner.register(createLeaveAccrualJob());

// ─── Start Server ────────────────────────────────────────────────────────────

console.log(`[scheduler] Starting on port ${port}...`);
const server = serve({ fetch: app.fetch, port });

// Start job runner after server is listening
runner.start();
console.log(`[scheduler] Job runner started with ${runner.getJobNames().length} job(s)`);

// ─── Graceful Shutdown ───────────────────────────────────────────────────────

function shutdown(signal: string): void {
  console.log(`[scheduler] Received ${signal}, shutting down...`);
  runner.stop();
  server.close(() => {
    console.log('[scheduler] Server closed');
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
