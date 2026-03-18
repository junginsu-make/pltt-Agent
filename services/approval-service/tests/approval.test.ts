import { describe, it, expect, vi, beforeEach } from 'vitest';

// Set JWT_SECRET before importing app (which loads serviceAuthMiddleware)
process.env.JWT_SECRET = 'test-secret-for-approval-service';

import { createServiceToken } from '@palette/shared/middleware/service-auth';
import app from '../src/app.js';

// ─── Mock DB ────────────────────────────────────────────────────────────────

// We use separate mocks for select-where vs update-where chains to avoid conflicts.
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockValues = vi.fn();
const mockReturning = vi.fn();
const mockSet = vi.fn();
const mockSelectWhere = vi.fn();
const mockUpdateWhere = vi.fn();
const mockFrom = vi.fn();
const mockOrderBy = vi.fn();

// Default return values for the chain
const mockUpdateReturning = vi.fn();

function setupChains() {
  // insert(...).values(...).returning(...)
  mockInsert.mockReturnValue({ values: mockValues });
  mockValues.mockReturnValue({ returning: mockReturning });
  mockReturning.mockResolvedValue([]);

  // select().from(...).where(...).orderBy(...)  OR  select().from(...).orderBy(...)
  // mockSelectWhere returns a thenable (for count queries) AND has orderBy (for ordered queries)
  mockSelect.mockReturnValue({ from: mockFrom });
  mockFrom.mockReturnValue({ where: mockSelectWhere, orderBy: mockOrderBy });
  mockSelectWhere.mockImplementation(() => {
    const result = Promise.resolve([{ cnt: 0 }]);
    return Object.assign(result, { orderBy: mockOrderBy });
  });
  mockOrderBy.mockResolvedValue([]);

  // update(...).set(...).where(...).returning(...)
  mockUpdate.mockReturnValue({ set: mockSet });
  mockSet.mockReturnValue({ where: mockUpdateWhere });
  mockUpdateWhere.mockReturnValue({ returning: mockUpdateReturning });
  mockUpdateReturning.mockResolvedValue([]);
}

vi.mock('../src/db.js', () => ({
  getDb: () => ({
    insert: mockInsert,
    select: mockSelect,
    update: mockUpdate,
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        insert: mockInsert,
        select: mockSelect,
        update: mockUpdate,
      };
      return fn(tx);
    },
  }),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

function resetMocks() {
  vi.clearAllMocks();
  setupChains();
}

function makeRequest(method: string, path: string, body?: unknown) {
  const token = createServiceToken('test-service');
  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  };
  if (body) init.body = JSON.stringify(body);
  return app.request(path, init);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('approval-service', () => {
  beforeEach(() => {
    resetMocks();
  });

  // ── Health Check ──────────────────────────────────────────────────────────

  describe('GET /health', () => {
    it('should return ok', async () => {
      const res = await app.request('/health');
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ status: 'ok', service: 'approval-service' });
    });
  });

  // ── POST /api/v1/approvals ────────────────────────────────────────────────

  describe('POST /api/v1/approvals', () => {
    const validBody = {
      type: 'leave_request',
      related_id: 'LV-2026-0001',
      requested_by: 'EMP-001',
      approver_id: 'EMP-DEV-LEADER',
      request_summary: '3월 18일 연차 1일 (개인사정)',
      auto_approve_hours: 2,
    };

    it('should create an approval and return 201', async () => {
      const now = new Date('2026-03-12T10:30:00Z');
      vi.useFakeTimers({ now });

      // Mock: count query for sequence (via mockSelectWhere — returns [{ cnt: 0 }] by default)

      // Mock: insert into approvals returning (returning call #1)
      mockReturning.mockResolvedValueOnce([
        {
          id: 'APR-2026-0001',
          status: 'pending',
          approverId: 'EMP-DEV-LEADER',
          autoApproveAt: new Date('2026-03-12T12:30:00Z'),
          type: 'leave_request',
          relatedId: 'LV-2026-0001',
          requestedBy: 'EMP-001',
          requestSummary: '3월 18일 연차 1일 (개인사정)',
          createdAt: now,
        },
      ]);

      // Mock: audit log - select latest for prev_hash (orderBy call #1)
      mockOrderBy.mockResolvedValueOnce([]);

      // Mock: insert audit log returning (returning call #2)
      mockReturning.mockResolvedValueOnce([{ id: 'audit-1' }]);

      const res = await makeRequest('POST', '/api/v1/approvals', validBody);
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.data).toBeDefined();
      expect(json.data.id).toBe('APR-2026-0001');
      expect(json.data.status).toBe('pending');
      expect(json.data.approver_id).toBe('EMP-DEV-LEADER');
      expect(json.data.auto_approve_at).toBeDefined();

      vi.useRealTimers();
    });

    it('should return 400 if required fields are missing', async () => {
      const res = await makeRequest('POST', '/api/v1/approvals', {});
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBeDefined();
    });

    it('should return 400 if type is missing', async () => {
      const { type: _type, ...body } = validBody;
      const res = await makeRequest('POST', '/api/v1/approvals', body);
      expect(res.status).toBe(400);
    });
  });

  // ── GET /api/v1/approvals/:id ─────────────────────────────────────────────

  describe('GET /api/v1/approvals/:id', () => {
    it('should return approval details', async () => {
      const approval = {
        id: 'APR-2026-0001',
        type: 'leave_request',
        relatedId: 'LV-2026-0001',
        requestedBy: 'EMP-001',
        approverId: 'EMP-DEV-LEADER',
        status: 'pending',
        requestSummary: '3월 18일 연차 1일 (개인사정)',
        reviewComment: null,
        autoApproveAt: new Date('2026-03-12T12:30:00Z'),
        createdAt: new Date('2026-03-12T10:30:00Z'),
        completedAt: null,
      };
      // select().from().where() resolves directly for getApprovalById
      mockSelectWhere.mockResolvedValueOnce([approval]);

      const res = await makeRequest('GET', '/api/v1/approvals/APR-2026-0001');
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data).toBeDefined();
      expect(json.data.id).toBe('APR-2026-0001');
      expect(json.data.status).toBe('pending');
      expect(json.data.approver_id).toBe('EMP-DEV-LEADER');
    });

    it('should return 404 if approval not found', async () => {
      mockSelectWhere.mockResolvedValueOnce([]);

      const res = await makeRequest('GET', '/api/v1/approvals/APR-9999-9999');
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.error).toBeDefined();
    });
  });

  // ── GET /api/v1/approvals/pending/:approverId ─────────────────────────────

  describe('GET /api/v1/approvals/pending/:approverId', () => {
    it('should return pending approvals for the approver', async () => {
      const pendingApprovals = [
        {
          id: 'APR-2026-0001',
          type: 'leave_request',
          relatedId: 'LV-2026-0001',
          requestedBy: 'EMP-001',
          requestSummary: '3월 18일 연차 1일 (개인사정)',
          autoApproveAt: new Date('2026-03-12T12:30:00Z'),
          createdAt: new Date('2026-03-12T10:30:00Z'),
          approverId: 'EMP-DEV-LEADER',
          status: 'pending',
          reviewComment: null,
          completedAt: null,
        },
      ];
      // select().from().where() returns { orderBy } for list queries
      mockSelectWhere.mockReturnValueOnce({ orderBy: mockOrderBy });
      mockOrderBy.mockResolvedValueOnce(pendingApprovals);

      const res = await makeRequest('GET', '/api/v1/approvals/pending/EMP-DEV-LEADER');
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data).toBeDefined();
      expect(json.data.approvals).toHaveLength(1);
      expect(json.data.approvals[0].id).toBe('APR-2026-0001');
      expect(json.data.approvals[0].type).toBe('leave_request');
    });

    it('should return empty array when no pending approvals', async () => {
      mockSelectWhere.mockReturnValueOnce({ orderBy: mockOrderBy });
      mockOrderBy.mockResolvedValueOnce([]);

      const res = await makeRequest('GET', '/api/v1/approvals/pending/EMP-NOBODY');
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.approvals).toHaveLength(0);
    });
  });

  // ── PATCH /api/v1/approvals/:id/decide ────────────────────────────────────

  describe('PATCH /api/v1/approvals/:id/decide', () => {
    const pendingApproval = {
      id: 'APR-2026-0001',
      type: 'leave_request',
      relatedId: 'LV-2026-0001',
      requestedBy: 'EMP-001',
      approverId: 'EMP-DEV-LEADER',
      status: 'pending',
      requestSummary: '3월 18일 연차 1일',
      reviewComment: null,
      autoApproveAt: new Date('2026-03-12T12:30:00Z'),
      createdAt: new Date('2026-03-12T10:30:00Z'),
      completedAt: null,
    };

    it('should approve a pending approval', async () => {
      const now = new Date('2026-03-12T11:00:00Z');
      vi.useFakeTimers({ now });

      // Mock: find approval (select.from.where)
      mockSelectWhere.mockResolvedValueOnce([pendingApproval]);

      // Mock: update().set().where().returning()
      mockUpdateReturning.mockResolvedValueOnce([
        {
          ...pendingApproval,
          status: 'approved',
          reviewComment: '확인함, 승인',
          completedAt: now,
        },
      ]);

      // Mock: audit log - select latest for prev_hash (orderBy)
      mockOrderBy.mockResolvedValueOnce([]);

      // Mock: insert audit log returning
      mockReturning.mockResolvedValueOnce([{ id: 'audit-2' }]);

      const res = await makeRequest('PATCH', '/api/v1/approvals/APR-2026-0001/decide', {
        decision: 'approved',
        decided_by: 'EMP-DEV-LEADER',
        comment: '확인함, 승인',
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toBeDefined();
      expect(json.data.approval_id).toBe('APR-2026-0001');
      expect(json.data.status).toBe('approved');
      expect(json.data.completed_at).toBeDefined();

      vi.useRealTimers();
    });

    it('should reject a pending approval with comment', async () => {
      const now = new Date('2026-03-12T11:00:00Z');
      vi.useFakeTimers({ now });

      // Mock: find approval
      mockSelectWhere.mockResolvedValueOnce([pendingApproval]);

      // Mock: update
      mockUpdateReturning.mockResolvedValueOnce([
        {
          ...pendingApproval,
          status: 'rejected',
          reviewComment: '일정 조정 필요',
          completedAt: now,
        },
      ]);

      // Mock: audit log prev hash
      mockOrderBy.mockResolvedValueOnce([]);

      // Mock: insert audit
      mockReturning.mockResolvedValueOnce([{ id: 'audit-3' }]);

      const res = await makeRequest('PATCH', '/api/v1/approvals/APR-2026-0001/decide', {
        decision: 'rejected',
        decided_by: 'EMP-DEV-LEADER',
        comment: '일정 조정 필요',
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.status).toBe('rejected');

      vi.useRealTimers();
    });

    it('should return 404 if approval not found', async () => {
      mockSelectWhere.mockResolvedValueOnce([]);

      const res = await makeRequest('PATCH', '/api/v1/approvals/APR-9999-9999/decide', {
        decision: 'approved',
        decided_by: 'EMP-DEV-LEADER',
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBeDefined();
    });

    it('should return AP_001 if already decided', async () => {
      const decidedApproval = { ...pendingApproval, status: 'approved' };
      mockSelectWhere.mockResolvedValueOnce([decidedApproval]);

      const res = await makeRequest('PATCH', '/api/v1/approvals/APR-2026-0001/decide', {
        decision: 'approved',
        decided_by: 'EMP-DEV-LEADER',
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('AP_001');
    });

    it('should return AP_002 if not the approver', async () => {
      mockSelectWhere.mockResolvedValueOnce([pendingApproval]);

      const res = await makeRequest('PATCH', '/api/v1/approvals/APR-2026-0001/decide', {
        decision: 'approved',
        decided_by: 'EMP-OTHER',
      });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error.code).toBe('AP_002');
    });

    it('should return 400 if rejected without comment', async () => {
      mockSelectWhere.mockResolvedValueOnce([pendingApproval]);

      const res = await makeRequest('PATCH', '/api/v1/approvals/APR-2026-0001/decide', {
        decision: 'rejected',
        decided_by: 'EMP-DEV-LEADER',
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBeDefined();
    });

    it('should return 400 if decision is invalid', async () => {
      const res = await makeRequest('PATCH', '/api/v1/approvals/APR-2026-0001/decide', {
        decision: 'maybe',
        decided_by: 'EMP-DEV-LEADER',
      });

      expect(res.status).toBe(400);
    });
  });

  // ── GET /api/v1/approvals/history/:approverId ─────────────────────────────

  describe('GET /api/v1/approvals/history/:approverId', () => {
    it('should return completed approvals for the approver', async () => {
      const historyApprovals = [
        {
          id: 'APR-2026-0001',
          type: 'leave_request',
          relatedId: 'LV-2026-0001',
          requestedBy: 'EMP-001',
          approverId: 'EMP-DEV-LEADER',
          status: 'approved',
          requestSummary: '3월 18일 연차 1일',
          reviewComment: '승인합니다',
          autoApproveAt: null,
          createdAt: new Date('2026-03-12T10:30:00Z'),
          completedAt: new Date('2026-03-12T11:00:00Z'),
        },
      ];
      mockSelectWhere.mockReturnValueOnce({ orderBy: mockOrderBy });
      mockOrderBy.mockResolvedValueOnce(historyApprovals);

      const res = await makeRequest('GET', '/api/v1/approvals/history/EMP-DEV-LEADER');
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.approvals).toHaveLength(1);
      expect(json.data.approvals[0].id).toBe('APR-2026-0001');
      expect(json.data.approvals[0].status).toBe('approved');
    });

    it('should return empty array when no history', async () => {
      mockSelectWhere.mockReturnValueOnce({ orderBy: mockOrderBy });
      mockOrderBy.mockResolvedValueOnce([]);

      const res = await makeRequest('GET', '/api/v1/approvals/history/EMP-NEW');
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.approvals).toHaveLength(0);
    });
  });
});
