import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { rateLimiter } from '@palette/shared';
import schedulerRoutes from './routes/scheduler.js';
import { errorHandler } from './middleware/error-handler.js';
import { getJobRunner } from './jobs/job-runner.js';

const app = new Hono();

app.use('*', logger());
app.use('*', cors({
  origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:3010', 'http://localhost:3020'],
}));
app.use('*', rateLimiter());

app.get('/health', (c) => {
  const runner = getJobRunner();
  const jobs = runner.getJobStates();

  return c.json({
    status: 'ok',
    service: 'scheduler',
    runner_active: runner.isRunning(),
    jobs_registered: jobs.length,
  });
});

// Mount scheduler admin routes
app.route('/api/v1/scheduler', schedulerRoutes);

// Error handler
app.onError(errorHandler);

export default app;
