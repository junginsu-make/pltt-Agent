import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import app from '../src/app.js';
import { JobRunner, resetJobRunner, getJobRunner } from '../src/jobs/job-runner.js';

// ─── Mock fetch globally ─────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(method: string, path: string, body?: unknown) {
  const init: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) init.body = JSON.stringify(body);
  return app.request(path, init);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('scheduler service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetJobRunner();
  });

  afterEach(() => {
    resetJobRunner();
  });

  // ── Health Check ──────────────────────────────────────────────────────────

  describe('GET /health', () => {
    it('should return ok with job runner status', async () => {
      const res = await app.request('/health');
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.status).toBe('ok');
      expect(json.service).toBe('scheduler');
      expect(json.runner_active).toBe(false);
      expect(json.jobs_registered).toBe(0);
    });

    it('should reflect registered jobs count', async () => {
      const runner = getJobRunner();
      runner.register({
        name: 'test-job',
        description: 'A test job',
        intervalMs: 60000,
        handler: async () => {},
      });

      const res = await app.request('/health');
      const json = await res.json();
      expect(json.jobs_registered).toBe(1);
    });
  });

  // ── Job Runner ────────────────────────────────────────────────────────────

  describe('JobRunner', () => {
    it('should register and list jobs', () => {
      const runner = new JobRunner();
      runner.register({
        name: 'job-a',
        description: 'Job A',
        intervalMs: 1000,
        handler: async () => {},
      });
      runner.register({
        name: 'job-b',
        description: 'Job B',
        intervalMs: 2000,
        handler: async () => {},
      });

      const names = runner.getJobNames();
      expect(names).toEqual(['job-a', 'job-b']);

      const states = runner.getJobStates();
      expect(states).toHaveLength(2);
      expect(states[0].name).toBe('job-a');
      expect(states[0].status).toBe('idle');
      expect(states[0].runCount).toBe(0);
    });

    it('should reject duplicate job names', () => {
      const runner = new JobRunner();
      runner.register({
        name: 'dup',
        description: 'First',
        intervalMs: 1000,
        handler: async () => {},
      });

      expect(() =>
        runner.register({
          name: 'dup',
          description: 'Second',
          intervalMs: 1000,
          handler: async () => {},
        }),
      ).toThrow('Job "dup" is already registered');
    });

    it('should execute a job via triggerJob', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const runner = new JobRunner();
      runner.register({
        name: 'trigger-test',
        description: 'Trigger test',
        intervalMs: 60000,
        handler,
      });

      const result = await runner.triggerJob('trigger-test');
      expect(result.success).toBe(true);
      expect(handler).toHaveBeenCalledOnce();

      const state = runner.getJobState('trigger-test');
      expect(state?.status).toBe('idle');
      expect(state?.runCount).toBe(1);
      expect(state?.lastRunAt).toBeTruthy();
    });

    it('should return error for non-existent job trigger', async () => {
      const runner = new JobRunner();
      const result = await runner.triggerJob('nonexistent');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should track errors when job handler throws', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('Boom'));
      const runner = new JobRunner();
      runner.register({
        name: 'failing-job',
        description: 'Fails every time',
        intervalMs: 60000,
        handler,
      });

      const result = await runner.triggerJob('failing-job');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Boom');

      const state = runner.getJobState('failing-job');
      expect(state?.status).toBe('error');
      expect(state?.errorCount).toBe(1);
      expect(state?.lastError).toBe('Boom');
    });

    it('should start and stop interval timers', () => {
      vi.useFakeTimers();

      const handler = vi.fn().mockResolvedValue(undefined);
      const runner = new JobRunner();
      runner.register({
        name: 'interval-test',
        description: 'Interval test',
        intervalMs: 1000,
        handler,
      });

      expect(runner.isRunning()).toBe(false);
      runner.start();
      expect(runner.isRunning()).toBe(true);

      // Advance past one interval
      vi.advanceTimersByTime(1100);
      expect(handler).toHaveBeenCalledTimes(1);

      runner.stop();
      expect(runner.isRunning()).toBe(false);

      // Advance more — handler should NOT be called again
      vi.advanceTimersByTime(2000);
      expect(handler).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it('should not start twice', () => {
      const runner = new JobRunner();
      runner.register({
        name: 'no-double',
        description: 'No double start',
        intervalMs: 60000,
        handler: async () => {},
      });

      runner.start();
      runner.start(); // Should be a no-op
      expect(runner.isRunning()).toBe(true);
      runner.stop();
    });
  });

  // ── Scheduler Routes ──────────────────────────────────────────────────────

  describe('GET /api/v1/scheduler/jobs', () => {
    it('should list all registered jobs', async () => {
      const runner = getJobRunner();
      runner.register({
        name: 'list-test',
        description: 'A test job',
        intervalMs: 5000,
        handler: async () => {},
      });

      const res = await makeRequest('GET', '/api/v1/scheduler/jobs');
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.jobs).toHaveLength(1);
      expect(json.data.jobs[0].name).toBe('list-test');
      expect(json.data.total).toBe(1);
      expect(json.data.runner_active).toBe(false);
    });
  });

  describe('POST /api/v1/scheduler/jobs/:name/run', () => {
    it('should manually trigger a registered job', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const runner = getJobRunner();
      runner.register({
        name: 'manual-trigger',
        description: 'Manual trigger test',
        intervalMs: 60000,
        handler,
      });

      const res = await makeRequest('POST', '/api/v1/scheduler/jobs/manual-trigger/run');
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.message).toContain('manual-trigger');
      expect(json.data.job.runCount).toBe(1);
      expect(handler).toHaveBeenCalledOnce();
    });

    it('should return 404 for unknown job name', async () => {
      const res = await makeRequest('POST', '/api/v1/scheduler/jobs/unknown-job/run');
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.error.code).toBe('NOT_FOUND');
    });

    it('should return 500 if job fails', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('Job failed'));
      const runner = getJobRunner();
      runner.register({
        name: 'fail-job',
        description: 'A failing job',
        intervalMs: 60000,
        handler,
      });

      const res = await makeRequest('POST', '/api/v1/scheduler/jobs/fail-job/run');
      expect(res.status).toBe(500);

      const json = await res.json();
      expect(json.error.code).toBe('JOB_FAILED');
    });
  });

  describe('GET /api/v1/scheduler/health', () => {
    it('should return healthy when no jobs have errors', async () => {
      const runner = getJobRunner();
      runner.register({
        name: 'healthy-job',
        description: 'Healthy job',
        intervalMs: 60000,
        handler: async () => {},
      });

      const res = await makeRequest('GET', '/api/v1/scheduler/health');
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.status).toBe('healthy');
      expect(json.data.jobs_total).toBe(1);
      expect(json.data.jobs_healthy).toBe(1);
      expect(json.data.jobs_error).toBe(0);
    });

    it('should return degraded when a job is in error state', async () => {
      const runner = getJobRunner();
      runner.register({
        name: 'err-job',
        description: 'Error job',
        intervalMs: 60000,
        handler: async () => {
          throw new Error('Intentional failure');
        },
      });

      // Trigger to put it in error state
      await runner.triggerJob('err-job');

      const res = await makeRequest('GET', '/api/v1/scheduler/health');
      const json = await res.json();
      expect(json.data.status).toBe('degraded');
      expect(json.data.jobs_error).toBe(1);
      expect(json.data.error_jobs).toHaveLength(1);
      expect(json.data.error_jobs[0].name).toBe('err-job');
    });
  });

  // ── Auto-Approval Job ─────────────────────────────────────────────────────

  describe('auto-approval job', () => {
    beforeEach(() => {
      vi.stubEnv('APPROVAL_SERVICE_URL', 'http://localhost:3002');
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('should fetch expired approvals and auto-approve them', async () => {
      // Dynamic import to ensure env vars are set
      const { runAutoApprovalJob } = await import('../src/jobs/auto-approval.js');

      const expiredApprovals = [
        {
          id: 'APR-2026-0001',
          auto_approve_at: '2026-03-12T12:30:00Z',
          approver_id: 'EMP-DEV-LEADER',
          related_id: 'LV-2026-0001',
          requested_by: 'EMP-001',
        },
      ];

      // Mock: fetch expired approvals
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { approvals: expiredApprovals } }),
      });

      // Mock: auto-approve PATCH
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            approval_id: 'APR-2026-0001',
            status: 'approved',
          },
        }),
      });

      await runAutoApprovalJob();

      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Verify the expired approvals fetch
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        'http://localhost:3002/api/v1/approvals/expired',
      );

      // Verify the auto-approve PATCH call
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        'http://localhost:3002/api/v1/approvals/APR-2026-0001/decide',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            decision: 'approved',
            decided_by: 'system',
            comment: '자동 승인 (시간 초과)',
          }),
        },
      );
    });

    it('should handle no expired approvals gracefully', async () => {
      const { runAutoApprovalJob } = await import('../src/jobs/auto-approval.js');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { approvals: [] } }),
      });

      await runAutoApprovalJob();

      // Should only make the fetch call, no PATCH calls
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should throw if APPROVAL_SERVICE_URL is not set', async () => {
      vi.unstubAllEnvs();
      delete process.env.APPROVAL_SERVICE_URL;

      // Re-import to get fresh module
      const { fetchExpiredApprovals } = await import('../src/jobs/auto-approval.js');

      await expect(fetchExpiredApprovals()).rejects.toThrow(
        'APPROVAL_SERVICE_URL environment variable is required',
      );
    });

    it('should handle fetch failure for expired approvals', async () => {
      const { runAutoApprovalJob } = await import('../src/jobs/auto-approval.js');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });

      await expect(runAutoApprovalJob()).rejects.toThrow('Failed to fetch expired approvals');
    });

    it('should continue processing remaining approvals when one fails', async () => {
      const { runAutoApprovalJob } = await import('../src/jobs/auto-approval.js');

      const expiredApprovals = [
        {
          id: 'APR-2026-0001',
          auto_approve_at: '2026-03-12T12:30:00Z',
          approver_id: 'EMP-DEV-LEADER',
          related_id: 'LV-2026-0001',
          requested_by: 'EMP-001',
        },
        {
          id: 'APR-2026-0002',
          auto_approve_at: '2026-03-12T12:30:00Z',
          approver_id: 'EMP-DEV-LEADER',
          related_id: 'LV-2026-0002',
          requested_by: 'EMP-002',
        },
      ];

      // Fetch expired
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { approvals: expiredApprovals } }),
      });

      // First approve fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: { code: 'AP_001', message: 'Already decided' } }),
      });

      // Second approve succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { approval_id: 'APR-2026-0002', status: 'approved' },
        }),
      });

      await runAutoApprovalJob();

      // All 3 fetches should have been made (1 list + 2 approvals)
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  // ── Leave Accrual Job ─────────────────────────────────────────────────────

  describe('leave-accrual job', () => {
    beforeEach(() => {
      vi.stubEnv('LEAVE_SERVICE_URL', 'http://localhost:3001');
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('should skip if not the 1st of the month', async () => {
      // Set date to the 15th
      vi.useFakeTimers({ now: new Date('2026-03-15T00:00:00Z') });

      const { runLeaveAccrualJob } = await import('../src/jobs/leave-accrual.js');
      await runLeaveAccrualJob();

      // Should not make any fetch calls
      expect(mockFetch).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should process employees on the 1st of the month', async () => {
      vi.useFakeTimers({ now: new Date('2026-04-01T00:00:00Z') });

      const { runLeaveAccrualJob } = await import('../src/jobs/leave-accrual.js');

      const employees = [
        {
          id: 'EMP-001',
          name: '정인수',
          hire_date: '2024-03-01',
          leave_policy_id: 'LP-DEFAULT',
        },
      ];

      const policy = {
        id: 'LP-DEFAULT',
        name: '기본 연차 정책',
        rules: {
          first_year: { type: 'monthly_accrual', days_per_month: 1, max_days: 11 },
          after_one_year: { type: 'annual_grant', base_days: 15, min_attendance_rate: 0.8 },
          seniority_bonus: {
            start_after_years: 3,
            bonus_days: 1,
            every_years: 2,
            max_total_days: 25,
          },
        },
      };

      // Fetch active employees
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { employees } }),
      });

      // Fetch leave policy
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: policy }),
      });

      // Post accrual — EMP-001 has 2+ years, but April is not January so skip
      // Actually, 2024-03-01 to 2026-04-01 = ~2 years, after_one_year applies
      // but annual grant only on January. So should be skipped.
      await runLeaveAccrualJob();

      // employees fetch + policy fetch = 2 calls
      // No accrual post because annual grant only applies in January
      expect(mockFetch).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('should accrue monthly for first-year employees', async () => {
      // Hired 2026-01-15, running on 2026-04-01 = 2.5 months
      vi.useFakeTimers({ now: new Date('2026-04-01T00:00:00Z') });

      const { runLeaveAccrualJob } = await import('../src/jobs/leave-accrual.js');

      const employees = [
        {
          id: 'EMP-NEW',
          name: '신입',
          hire_date: '2026-01-15',
          leave_policy_id: 'LP-DEFAULT',
        },
      ];

      const policy = {
        id: 'LP-DEFAULT',
        name: '기본 연차 정책',
        rules: {
          first_year: { type: 'monthly_accrual', days_per_month: 1, max_days: 11 },
          after_one_year: { type: 'annual_grant', base_days: 15, min_attendance_rate: 0.8 },
          seniority_bonus: {
            start_after_years: 3,
            bonus_days: 1,
            every_years: 2,
            max_total_days: 25,
          },
        },
      };

      // Fetch active employees
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { employees } }),
      });

      // Fetch leave policy
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: policy }),
      });

      // Post accrual
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { employee_id: 'EMP-NEW', days_added: 1, balance_after: 3 },
        }),
      });

      await runLeaveAccrualJob();

      // 3 calls: employees, policy, accrual post
      expect(mockFetch).toHaveBeenCalledTimes(3);

      // Verify accrual post
      const accrualCall = mockFetch.mock.calls[2];
      expect(accrualCall[0]).toBe('http://localhost:3001/api/v1/leave/accrual');
      expect(accrualCall[1].method).toBe('POST');

      const body = JSON.parse(accrualCall[1].body);
      expect(body.employee_id).toBe('EMP-NEW');
      expect(body.days).toBe(1);
      expect(body.accrual_type).toBe('monthly_auto');

      vi.useRealTimers();
    });

    it('should throw if LEAVE_SERVICE_URL is not set', async () => {
      vi.unstubAllEnvs();
      delete process.env.LEAVE_SERVICE_URL;

      const { fetchActiveEmployees } = await import('../src/jobs/leave-accrual.js');

      await expect(fetchActiveEmployees()).rejects.toThrow(
        'LEAVE_SERVICE_URL environment variable is required',
      );
    });
  });

  // ── calculateAccrualDays ──────────────────────────────────────────────────

  describe('calculateAccrualDays', () => {
    const policy = {
      id: 'LP-DEFAULT',
      name: '기본 연차 정책',
      rules: {
        first_year: { type: 'monthly_accrual', days_per_month: 1, max_days: 11 },
        after_one_year: { type: 'annual_grant', base_days: 15, min_attendance_rate: 0.8 },
        seniority_bonus: {
          start_after_years: 3,
          bonus_days: 1,
          every_years: 2,
          max_total_days: 25,
        },
      },
    };

    it('should return 1 day/month for first-year employee', async () => {
      const { calculateAccrualDays } = await import('../src/jobs/leave-accrual.js');
      const result = calculateAccrualDays(
        '2026-01-15',
        policy,
        new Date('2026-04-01T00:00:00Z'),
      );
      expect(result).not.toBeNull();
      expect(result!.days).toBe(1);
      expect(result!.reason).toContain('월별 자동 발생');
    });

    it('should return null for employee hired this month (0 months worked)', async () => {
      const { calculateAccrualDays } = await import('../src/jobs/leave-accrual.js');
      const result = calculateAccrualDays(
        '2026-04-15',
        policy,
        new Date('2026-04-01T00:00:00Z'),
      );
      expect(result).toBeNull();
    });

    it('should return annual grant on January 1st for veteran', async () => {
      const { calculateAccrualDays } = await import('../src/jobs/leave-accrual.js');
      // Hired 2023-01-01, running on 2026-01-01 = 3 years
      const result = calculateAccrualDays(
        '2023-01-01',
        policy,
        new Date('2026-01-01T00:00:00Z'),
      );
      expect(result).not.toBeNull();
      // 3 years = base_days(15) + seniority_bonus(1) = 16
      expect(result!.days).toBe(16);
      expect(result!.reason).toContain('연간 자동 발생');
    });

    it('should return null for veteran on non-January month', async () => {
      const { calculateAccrualDays } = await import('../src/jobs/leave-accrual.js');
      const result = calculateAccrualDays(
        '2023-01-01',
        policy,
        new Date('2026-04-01T00:00:00Z'),
      );
      expect(result).toBeNull();
    });

    it('should cap total days at max_total_days', async () => {
      const { calculateAccrualDays } = await import('../src/jobs/leave-accrual.js');
      // Hired 2006-01-01 = 20 years. base(15) + many bonuses but capped at 25
      const result = calculateAccrualDays(
        '2006-01-01',
        policy,
        new Date('2026-01-01T00:00:00Z'),
      );
      expect(result).not.toBeNull();
      expect(result!.days).toBeLessThanOrEqual(25);
    });
  });
});
