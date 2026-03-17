import { Hono } from 'hono';
import { z } from 'zod';
import { getJobRunner } from '../jobs/job-runner.js';

// ─── Validation Schemas ──────────────────────────────────────────────────────

const jobNameParamSchema = z.object({
  name: z.string().min(1, 'job name is required'),
});

// ─── Routes ──────────────────────────────────────────────────────────────────

const schedulerRoutes = new Hono();

// GET /api/v1/scheduler/jobs — List all jobs and their status
schedulerRoutes.get('/jobs', (c) => {
  const runner = getJobRunner();
  const jobs = runner.getJobStates();

  return c.json({
    data: {
      jobs,
      total: jobs.length,
      runner_active: runner.isRunning(),
    },
  });
});

// POST /api/v1/scheduler/jobs/:name/run — Manually trigger a job
schedulerRoutes.post('/jobs/:name/run', async (c) => {
  const params = jobNameParamSchema.safeParse({ name: c.req.param('name') });
  if (!params.success) {
    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid job name',
          details: params.error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
      },
      400,
    );
  }

  const runner = getJobRunner();
  const jobState = runner.getJobState(params.data.name);

  if (!jobState) {
    return c.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: `Job "${params.data.name}" not found`,
        },
      },
      404,
    );
  }

  const result = await runner.triggerJob(params.data.name);

  if (!result.success) {
    return c.json(
      {
        error: {
          code: 'JOB_FAILED',
          message: result.error ?? 'Job execution failed',
        },
      },
      500,
    );
  }

  const updatedState = runner.getJobState(params.data.name);
  return c.json({
    data: {
      message: `Job "${params.data.name}" triggered successfully`,
      job: updatedState,
    },
  });
});

// GET /api/v1/scheduler/health — Detailed health with job info
schedulerRoutes.get('/health', (c) => {
  const runner = getJobRunner();
  const jobs = runner.getJobStates();
  const errorJobs = jobs.filter((j) => j.status === 'error');

  return c.json({
    data: {
      status: errorJobs.length === 0 ? 'healthy' : 'degraded',
      runner_active: runner.isRunning(),
      jobs_total: jobs.length,
      jobs_healthy: jobs.length - errorJobs.length,
      jobs_error: errorJobs.length,
      error_jobs: errorJobs.map((j) => ({
        name: j.name,
        lastError: j.lastError,
        errorCount: j.errorCount,
      })),
      jobs,
    },
  });
});

export default schedulerRoutes;
