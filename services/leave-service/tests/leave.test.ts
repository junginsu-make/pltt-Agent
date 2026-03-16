import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Use vi.hoisted for mock data that vi.mock factories need ───────────────
const {
  mockEmployees,
  mockLeaveBalances,
  mockLeaveRequests,
  mockHolidays,
  employeeCallQueue,
  resetMockData,
} = vi.hoisted(() => {
  const data = {
    mockEmployees: { value: [] as any[] },
    mockLeaveBalances: { value: [] as any[] },
    mockLeaveRequests: { value: [] as any[] },
    mockHolidays: { value: [] as any[] },
    // Queue for sequential employee lookups - if populated, shift values from here
    employeeCallQueue: { value: [] as any[][] },
    resetMockData: () => {
      data.mockEmployees.value = [];
      data.mockLeaveBalances.value = [];
      data.mockLeaveRequests.value = [];
      data.mockHolidays.value = [];
      data.employeeCallQueue.value = [];
    },
  };
  return data;
});

// Helper to determine data based on table reference
function getFilteredData(table: any): any[] {
  if (table && table.id && table.email && table.passwordHash) {
    // If there's a queue of responses, use the next one
    if (employeeCallQueue.value.length > 0) {
      return employeeCallQueue.value.shift()!;
    }
    return [...mockEmployees.value];
  }
  if (table && table.totalDays && table.usedDays) {
    return [...mockLeaveBalances.value];
  }
  if (table && table.startDate && table.endDate && table.days) {
    return [...mockLeaveRequests.value];
  }
  if (table && table.date && table.name && table.year && !table.email) {
    return [...mockHolidays.value];
  }
  return [];
}

// Mock drizzle-orm before anything else
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: any[]) => ({ type: 'eq', args })),
  and: vi.fn((...args: any[]) => ({ type: 'and', args })),
  or: vi.fn((...args: any[]) => ({ type: 'or', args })),
  sql: Object.assign(
    vi.fn((strings: any, ...values: any[]) => ({
      type: 'sql',
      strings,
      values,
    })),
    {
      join: vi.fn((...args: any[]) => ({ type: 'sql_join', args })),
    },
  ),
  gte: vi.fn((...args: any[]) => ({ type: 'gte', args })),
  lte: vi.fn((...args: any[]) => ({ type: 'lte', args })),
  count: vi.fn(() => ({ type: 'count' })),
  relations: vi.fn(() => ({})),
}));

// Mock the db module
vi.mock('../src/db.js', () => {
  function createTerminal(table: any) {
    const term: any = {};
    term.offset = vi.fn().mockImplementation(() => Promise.resolve(getFilteredData(table)));
    term.then = (resolve: any, reject?: any) => {
      try { resolve(getFilteredData(table)); } catch (e) { if (reject) reject(e); }
    };
    return term;
  }

  function createFromChain(table: any) {
    const innerChain: any = {};
    innerChain.where = vi.fn().mockImplementation(() => {
      const resultChain: any = {};
      resultChain.limit = vi.fn().mockImplementation(() => createTerminal(table));
      resultChain.then = (resolve: any, reject?: any) => {
        try { resolve(getFilteredData(table)); } catch (e) { if (reject) reject(e); }
      };
      return resultChain;
    });
    innerChain.limit = vi.fn().mockImplementation(() => createTerminal(table));
    innerChain.then = (resolve: any, reject?: any) => {
      try { resolve(getFilteredData(table)); } catch (e) { if (reject) reject(e); }
    };
    return innerChain;
  }

  const db = {
    select: vi.fn().mockImplementation(() => {
      return {
        from: vi.fn().mockImplementation((table: any) => {
          return createFromChain(table);
        }),
      };
    }),
    insert: vi.fn().mockImplementation(() => {
      return {
        values: vi.fn().mockImplementation((vals: any) => {
          return {
            returning: vi.fn().mockImplementation(() => {
              const now = new Date();
              const created = { ...vals, createdAt: now, updatedAt: now };
              return Promise.resolve([created]);
            }),
          };
        }),
      };
    }),
    update: vi.fn().mockImplementation(() => {
      return {
        set: vi.fn().mockImplementation(() => {
          return {
            where: vi.fn().mockImplementation(() => {
              return Promise.resolve([]);
            }),
          };
        }),
      };
    }),
  };

  return { db };
});

// ─── Import app after mocks ────────────────────────────────────────────────
import app from '../src/app.js';

// ─── Test Helpers ───────────────────────────────────────────────────────────

function makeRequest(method: string, path: string, body?: any) {
  const url = `http://localhost${path}`;
  const init: RequestInit = { method };
  if (body) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  return app.request(url, init);
}

// ─── Reset mocks between tests ─────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  resetMockData();
});

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('Leave Service API', () => {
  // ─── Health Check ───────────────────────────────────────────────────────
  describe('GET /health', () => {
    it('should return ok status', async () => {
      const res = await makeRequest('GET', '/health');
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ status: 'ok', service: 'leave-service' });
    });
  });

  // ─── GET /api/v1/leave/balance/:employeeId ─────────────────────────────
  describe('GET /api/v1/leave/balance/:employeeId', () => {
    it('should return leave balance for existing employee', async () => {
      mockEmployees.value = [
        { id: 'EMP-001', name: '홍길동', email: 'hong@test.com', passwordHash: 'x', teamId: 'TEAM-DEV', managerId: null, hireDate: '2020-01-01', status: 'active' },
      ];
      mockLeaveBalances.value = [
        {
          id: 'bal-1',
          employeeId: 'EMP-001',
          year: 2026,
          leaveType: 'annual',
          totalDays: '15',
          usedDays: '1',
          pendingDays: '0',
          remainingDays: '14',
          expiresAt: '2027-03-01',
        },
      ];

      const res = await makeRequest('GET', '/api/v1/leave/balance/EMP-001?year=2026');
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data).toBeDefined();
      expect(json.data.employee_id).toBe('EMP-001');
      expect(json.data.year).toBe(2026);
      expect(json.data.balances).toHaveLength(1);
      expect(json.data.balances[0].leave_type).toBe('annual');
      expect(json.data.balances[0].total_days).toBe(15);
      expect(json.data.balances[0].used_days).toBe(1);
      expect(json.data.balances[0].pending_days).toBe(0);
      expect(json.data.balances[0].remaining_days).toBe(14);
      expect(json.data.balances[0].expires_at).toBe('2027-03-01');
    });

    it('should return LV_004 error if employee not found', async () => {
      mockEmployees.value = [];

      const res = await makeRequest('GET', '/api/v1/leave/balance/EMP-999');
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBeDefined();
      expect(json.error.code).toBe('LV_004');
    });

    it('should return empty balances array when no balance records', async () => {
      mockEmployees.value = [
        { id: 'EMP-002', name: '김철수', email: 'kim@test.com', passwordHash: 'x', teamId: null, managerId: null, hireDate: '2020-01-01', status: 'active' },
      ];
      mockLeaveBalances.value = [];

      const res = await makeRequest('GET', '/api/v1/leave/balance/EMP-002?year=2026');
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.balances).toEqual([]);
    });
  });

  // ─── POST /api/v1/leave/validate-date ──────────────────────────────────
  describe('POST /api/v1/leave/validate-date', () => {
    it('should return valid=true for a valid business day', async () => {
      mockEmployees.value = [
        { id: 'EMP-001', name: '홍길동', email: 'hong@test.com', passwordHash: 'x', teamId: 'TEAM-DEV', managerId: null, hireDate: '2020-01-01', status: 'active' },
      ];
      mockHolidays.value = [];
      mockLeaveRequests.value = [];

      const res = await makeRequest('POST', '/api/v1/leave/validate-date', {
        employee_id: 'EMP-001',
        date: '2026-12-15', // a Tuesday
        leave_type: 'annual',
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.valid).toBe(true);
      expect(json.data.reasons).toEqual([]);
      expect(json.data.day_of_week).toBe('화요일');
      expect(json.data.is_holiday).toBe(false);
    });

    it('should return valid=false for a weekend', async () => {
      mockEmployees.value = [
        { id: 'EMP-001', name: '홍길동', email: 'hong@test.com', passwordHash: 'x', teamId: null, managerId: null, hireDate: '2020-01-01', status: 'active' },
      ];

      const res = await makeRequest('POST', '/api/v1/leave/validate-date', {
        employee_id: 'EMP-001',
        date: '2026-12-13', // a Sunday
        leave_type: 'annual',
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.valid).toBe(false);
      expect(json.data.reasons.length).toBeGreaterThan(0);
      expect(json.data.day_of_week).toBe('일요일');
    });

    it('should return valid=false for a holiday', async () => {
      mockEmployees.value = [
        { id: 'EMP-001', name: '홍길동', email: 'hong@test.com', passwordHash: 'x', teamId: null, managerId: null, hireDate: '2020-01-01', status: 'active' },
      ];
      mockHolidays.value = [{ date: '2026-12-25', name: '크리스마스', year: 2026 }];

      const res = await makeRequest('POST', '/api/v1/leave/validate-date', {
        employee_id: 'EMP-001',
        date: '2026-12-25', // Christmas, Friday
        leave_type: 'annual',
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.is_holiday).toBe(true);
      expect(json.data.valid).toBe(false);
    });

    it('should return LV_004 if employee not found', async () => {
      mockEmployees.value = [];

      const res = await makeRequest('POST', '/api/v1/leave/validate-date', {
        employee_id: 'EMP-999',
        date: '2026-12-15',
        leave_type: 'annual',
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('LV_004');
    });

    it('should include team_conflicts field', async () => {
      mockEmployees.value = [
        { id: 'EMP-001', name: '홍길동', email: 'hong@test.com', passwordHash: 'x', teamId: 'TEAM-DEV', managerId: null, hireDate: '2020-01-01', status: 'active' },
      ];
      mockHolidays.value = [];
      mockLeaveRequests.value = [];

      const res = await makeRequest('POST', '/api/v1/leave/validate-date', {
        employee_id: 'EMP-001',
        date: '2026-12-15',
        leave_type: 'annual',
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.team_conflicts).toBeDefined();
      expect(Array.isArray(json.data.team_conflicts)).toBe(true);
    });
  });

  // ─── POST /api/v1/leave/request ────────────────────────────────────────
  describe('POST /api/v1/leave/request', () => {
    it('should create a leave request successfully', async () => {
      // Use queue: first call returns employee, subsequent calls return different data
      // Call sequence in createLeaveRequest:
      // 1. Find employee -> [EMP-001]
      // 2. Find manager -> [EMP-MGR]
      employeeCallQueue.value = [
        [{ id: 'EMP-001', name: '홍길동', email: 'hong@test.com', passwordHash: 'x', teamId: 'TEAM-DEV', managerId: 'EMP-MGR', hireDate: '2020-01-01', status: 'active' }],
        [{ id: 'EMP-MGR', name: '이매니저', email: 'mgr@test.com', passwordHash: 'x', teamId: 'TEAM-DEV', managerId: null, hireDate: '2019-01-01', status: 'active' }],
      ];
      mockLeaveBalances.value = [
        {
          id: 'bal-1',
          employeeId: 'EMP-001',
          year: 2026,
          leaveType: 'annual',
          totalDays: '15',
          usedDays: '1',
          pendingDays: '0',
          remainingDays: '14',
          expiresAt: '2027-03-01',
        },
      ];
      mockLeaveRequests.value = [];
      mockHolidays.value = [];

      const res = await makeRequest('POST', '/api/v1/leave/request', {
        employee_id: 'EMP-001',
        leave_type: 'annual',
        start_date: '2026-12-15',
        end_date: '2026-12-15',
        days: 1,
        reason: '개인사정',
        conversation_id: 'ch-xxx',
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data).toBeDefined();
      expect(json.data.request).toBeDefined();
      expect(json.data.request.employee_id).toBe('EMP-001');
      expect(json.data.request.leave_type).toBe('annual');
      expect(json.data.request.status).toBe('pending');
      expect(json.data.request.days).toBe(1);
      expect(json.data.approval).toBeDefined();
    });

    it('should return LV_004 if employee not found', async () => {
      mockEmployees.value = [];

      const res = await makeRequest('POST', '/api/v1/leave/request', {
        employee_id: 'EMP-999',
        leave_type: 'annual',
        start_date: '2026-12-15',
        end_date: '2026-12-15',
        days: 1,
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('LV_004');
    });

    it('should return LV_001 if insufficient balance', async () => {
      mockEmployees.value = [
        { id: 'EMP-001', name: '홍길동', email: 'hong@test.com', passwordHash: 'x', teamId: null, managerId: null, hireDate: '2020-01-01', status: 'active' },
      ];
      mockLeaveBalances.value = []; // No balance records
      mockHolidays.value = [];
      mockLeaveRequests.value = [];

      const res = await makeRequest('POST', '/api/v1/leave/request', {
        employee_id: 'EMP-001',
        leave_type: 'annual',
        start_date: '2026-12-15',
        end_date: '2026-12-15',
        days: 1,
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('LV_001');
    });

    it('should return LV_002 if date is weekend', async () => {
      mockEmployees.value = [
        { id: 'EMP-001', name: '홍길동', email: 'hong@test.com', passwordHash: 'x', teamId: null, managerId: null, hireDate: '2020-01-01', status: 'active' },
      ];
      mockLeaveBalances.value = [
        { id: 'bal-1', employeeId: 'EMP-001', year: 2026, leaveType: 'annual', totalDays: '15', usedDays: '0', pendingDays: '0', remainingDays: '15', expiresAt: null },
      ];
      mockHolidays.value = [];

      const res = await makeRequest('POST', '/api/v1/leave/request', {
        employee_id: 'EMP-001',
        leave_type: 'annual',
        start_date: '2026-12-13', // Sunday
        end_date: '2026-12-13',
        days: 1,
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('LV_002');
    });

    it('should return LV_003 if duplicate leave request exists', async () => {
      mockEmployees.value = [
        { id: 'EMP-001', name: '홍길동', email: 'hong@test.com', passwordHash: 'x', teamId: null, managerId: null, hireDate: '2020-01-01', status: 'active' },
      ];
      mockLeaveBalances.value = [
        { id: 'bal-1', employeeId: 'EMP-001', year: 2026, leaveType: 'annual', totalDays: '15', usedDays: '0', pendingDays: '1', remainingDays: '14', expiresAt: null },
      ];
      mockHolidays.value = [];
      // There's already a leave request for that date
      mockLeaveRequests.value = [
        {
          id: 'LV-2026-0001',
          employeeId: 'EMP-001',
          leaveType: 'annual',
          startDate: '2026-12-15',
          endDate: '2026-12-15',
          days: '1',
          status: 'pending',
          reason: null,
          createdAt: new Date(),
        },
      ];

      const res = await makeRequest('POST', '/api/v1/leave/request', {
        employee_id: 'EMP-001',
        leave_type: 'annual',
        start_date: '2026-12-15',
        end_date: '2026-12-15',
        days: 1,
      });

      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error.code).toBe('LV_003');
    });

    it('should include approval info with manager', async () => {
      // Use queue for sequential employee lookups
      // createLeaveRequest calls:
      // 1. Find employee by ID -> returns EMP-001
      // 2. Find manager by managerId -> returns EMP-MGR
      employeeCallQueue.value = [
        [{ id: 'EMP-001', name: '홍길동', email: 'hong@test.com', passwordHash: 'x', teamId: 'TEAM-DEV', managerId: 'EMP-MGR', hireDate: '2020-01-01', status: 'active' }],
        [{ id: 'EMP-MGR', name: '이매니저', email: 'mgr@test.com', passwordHash: 'x', teamId: 'TEAM-DEV', managerId: null, hireDate: '2019-01-01', status: 'active' }],
      ];
      mockLeaveBalances.value = [
        { id: 'bal-1', employeeId: 'EMP-001', year: 2026, leaveType: 'annual', totalDays: '15', usedDays: '0', pendingDays: '0', remainingDays: '15', expiresAt: null },
      ];
      mockHolidays.value = [];
      mockLeaveRequests.value = [];

      const res = await makeRequest('POST', '/api/v1/leave/request', {
        employee_id: 'EMP-001',
        leave_type: 'annual',
        start_date: '2026-12-15',
        end_date: '2026-12-15',
        days: 1,
        reason: '개인사정',
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.approval).toBeDefined();
      expect(json.data.approval.approver_id).toBe('EMP-MGR');
      expect(json.data.approval.approver_name).toBe('이매니저');
    });
  });

  // ─── DELETE /api/v1/leave/request/:id ──────────────────────────────────
  describe('DELETE /api/v1/leave/request/:id', () => {
    it('should cancel a pending leave request', async () => {
      mockLeaveRequests.value = [
        {
          id: 'LV-2026-0001',
          employeeId: 'EMP-001',
          leaveType: 'annual',
          startDate: '2026-12-15',
          endDate: '2026-12-15',
          days: '1',
          status: 'pending',
          reason: null,
          createdAt: new Date(),
        },
      ];

      const res = await makeRequest('DELETE', '/api/v1/leave/request/LV-2026-0001');
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data.id).toBe('LV-2026-0001');
      expect(json.data.status).toBe('cancelled');
    });

    it('should return LV_005 if request is not pending', async () => {
      mockLeaveRequests.value = [
        {
          id: 'LV-2026-0002',
          employeeId: 'EMP-001',
          leaveType: 'annual',
          startDate: '2026-12-15',
          endDate: '2026-12-15',
          days: '1',
          status: 'approved',
          reason: null,
          createdAt: new Date(),
        },
      ];

      const res = await makeRequest('DELETE', '/api/v1/leave/request/LV-2026-0002');
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error.code).toBe('LV_005');
    });

    it('should return LV_004 if request not found', async () => {
      mockLeaveRequests.value = [];

      const res = await makeRequest('DELETE', '/api/v1/leave/request/LV-NONEXISTENT');
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error.code).toBe('LV_004');
    });
  });

  // ─── GET /api/v1/leave/holidays ────────────────────────────────────────
  describe('GET /api/v1/leave/holidays', () => {
    it('should return holidays for the given year', async () => {
      mockHolidays.value = [
        { date: '2026-01-01', name: '신정', year: 2026 },
        { date: '2026-03-01', name: '삼일절', year: 2026 },
        { date: '2026-12-25', name: '크리스마스', year: 2026 },
      ];

      const res = await makeRequest('GET', '/api/v1/leave/holidays?year=2026');
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data).toHaveLength(3);
      expect(json.data[0].date).toBe('2026-01-01');
      expect(json.data[0].name).toBe('신정');
    });

    it('should return empty array when no holidays', async () => {
      mockHolidays.value = [];

      const res = await makeRequest('GET', '/api/v1/leave/holidays?year=2030');
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data).toEqual([]);
    });
  });

  // ─── GET /api/v1/leave/team-schedule ───────────────────────────────────
  describe('GET /api/v1/leave/team-schedule', () => {
    it('should return team schedule for given month', async () => {
      mockEmployees.value = [
        { id: 'EMP-001', name: '홍길동', email: 'hong@test.com', passwordHash: 'x', teamId: 'TEAM-DEV', managerId: null, hireDate: '2020-01-01', status: 'active' },
        { id: 'EMP-002', name: '김철수', email: 'kim@test.com', passwordHash: 'x', teamId: 'TEAM-DEV', managerId: null, hireDate: '2020-01-01', status: 'active' },
      ];
      mockLeaveRequests.value = [
        {
          id: 'LV-2026-0001',
          employeeId: 'EMP-001',
          leaveType: 'annual',
          startDate: '2026-03-15',
          endDate: '2026-03-15',
          days: '1',
          status: 'approved',
          reason: null,
          createdAt: new Date(),
        },
      ];

      const res = await makeRequest('GET', '/api/v1/leave/team-schedule?teamId=TEAM-DEV&month=2026-03');
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data).toBeDefined();
      expect(Array.isArray(json.data)).toBe(true);
    });

    it('should return 400 if teamId is missing', async () => {
      const res = await makeRequest('GET', '/api/v1/leave/team-schedule?month=2026-03');
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBeDefined();
    });

    it('should return 400 if month is missing', async () => {
      const res = await makeRequest('GET', '/api/v1/leave/team-schedule?teamId=TEAM-DEV');
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBeDefined();
    });

    it('should return empty array for team with no members', async () => {
      mockEmployees.value = [];

      const res = await makeRequest('GET', '/api/v1/leave/team-schedule?teamId=TEAM-EMPTY&month=2026-03');
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.data).toEqual([]);
    });
  });
});
