import { eq, and, sql, gte, lte, count, or } from 'drizzle-orm';
import { db } from '../db.js';
import { leaveRequests, leaveBalances, holidays, employees } from '@palette/db';
import { AppError, generateLeaveRequestId, isWeekend, formatDate } from '@palette/shared';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ValidateDateRequest {
  employee_id: string;
  date: string;
  leave_type: string;
}

export interface ValidateDateResponse {
  valid: boolean;
  reasons: string[];
  day_of_week: string;
  team_conflicts: Array<{ employee_id: string; employee_name: string; leave_type: string }>;
  is_holiday: boolean;
}

export interface CreateLeaveRequestInput {
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  reason?: string;
  conversation_id?: string;
}

export interface TeamScheduleEntry {
  employee_id: string;
  employee_name: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  status: string;
}

// ─── Day of Week (Korean) ───────────────────────────────────────────────────

const DAY_NAMES_KO = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

function getDayOfWeekKo(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return DAY_NAMES_KO[d.getDay()];
}

// ─── Validate Date ──────────────────────────────────────────────────────────

export async function validateDate(input: ValidateDateRequest): Promise<ValidateDateResponse> {
  const { employee_id, date, leave_type: _leaveType } = input;
  const reasons: string[] = [];

  // Check employee exists
  const emp = await db.select().from(employees).where(eq(employees.id, employee_id)).limit(1);
  if (emp.length === 0) {
    throw new AppError('LV_004', [{ field: 'employee_id', message: '직원을 찾을 수 없습니다' }]);
  }

  const dateObj = new Date(date + 'T00:00:00');
  const dayOfWeek = getDayOfWeekKo(date);

  // Check weekend
  if (isWeekend(dateObj)) {
    reasons.push('주말은 휴가 신청이 불가합니다');
  }

  // Check holiday
  const holidayRows = await db
    .select()
    .from(holidays)
    .where(eq(holidays.date, date));
  const isHoliday = holidayRows.length > 0;
  if (isHoliday) {
    reasons.push(`공휴일(${holidayRows[0].name})은 휴가 신청이 불가합니다`);
  }

  // Check past date
  const today = formatDate(new Date());
  if (date < today) {
    reasons.push('과거 날짜는 신청 불가합니다');
  }

  // Check team conflicts (same team, same date, approved or pending)
  const teamConflicts: ValidateDateResponse['team_conflicts'] = [];
  if (emp[0].teamId) {
    const teammates = await db
      .select({ id: employees.id, name: employees.name })
      .from(employees)
      .where(
        and(
          eq(employees.teamId, emp[0].teamId),
          sql`${employees.id} != ${employee_id}`,
        ),
      );

    if (teammates.length > 0) {
      const teammateIds = teammates.map((t) => t.id);
      const conflicts = await db
        .select()
        .from(leaveRequests)
        .where(
          and(
            sql`${leaveRequests.employeeId} IN (${sql.join(teammateIds.map(id => sql`${id}`), sql`, `)})`,
            lte(leaveRequests.startDate, date),
            gte(leaveRequests.endDate, date),
            or(
              eq(leaveRequests.status, 'approved'),
              eq(leaveRequests.status, 'pending'),
            ),
          ),
        );

      for (const conflict of conflicts) {
        const teammate = teammates.find((t) => t.id === conflict.employeeId);
        if (teammate) {
          teamConflicts.push({
            employee_id: teammate.id,
            employee_name: teammate.name,
            leave_type: conflict.leaveType,
          });
        }
      }
    }
  }

  return {
    valid: reasons.length === 0,
    reasons,
    day_of_week: dayOfWeek,
    team_conflicts: teamConflicts,
    is_holiday: isHoliday,
  };
}

// ─── Create Leave Request ───────────────────────────────────────────────────

export async function createLeaveRequest(input: CreateLeaveRequestInput) {
  const { employee_id, leave_type, start_date, end_date, days, reason, conversation_id } = input;

  // 1. Validate employee exists
  const emp = await db.select().from(employees).where(eq(employees.id, employee_id)).limit(1);
  if (emp.length === 0) {
    throw new AppError('LV_004', [{ field: 'employee_id', message: '직원을 찾을 수 없습니다' }]);
  }

  // 2. Validate dates (weekend, holiday, past)
  const startDate = new Date(start_date + 'T00:00:00');
  const endDate = new Date(end_date + 'T00:00:00');
  const today = formatDate(new Date());

  if (start_date < today) {
    throw new AppError('LV_004', [{ field: 'start_date', message: '과거 날짜는 신청 불가' }]);
  }

  // Check each date in range
  const current = new Date(startDate);
  while (current <= endDate) {
    const dateStr = formatDate(current);
    if (isWeekend(current)) {
      throw new AppError('LV_002', [{ field: 'date', message: `${dateStr}는 주말입니다` }]);
    }
    const hol = await db.select().from(holidays).where(eq(holidays.date, dateStr));
    if (hol.length > 0) {
      throw new AppError('LV_002', [{ field: 'date', message: `${dateStr}는 공휴일(${hol[0].name})입니다` }]);
    }
    current.setDate(current.getDate() + 1);
  }

  // 3. Check remaining balance >= days
  const year = new Date(start_date).getFullYear();
  const balanceRows = await db
    .select()
    .from(leaveBalances)
    .where(
      and(
        eq(leaveBalances.employeeId, employee_id),
        eq(leaveBalances.year, year),
        eq(leaveBalances.leaveType, leave_type),
      ),
    );

  if (balanceRows.length === 0) {
    throw new AppError('LV_001', [{ field: 'balance', message: '잔여 연차가 없습니다' }]);
  }

  const balance = balanceRows[0];
  const remaining = Number(balance.totalDays) - Number(balance.usedDays ?? 0) - Number(balance.pendingDays ?? 0);
  if (remaining < days) {
    throw new AppError('LV_001', [{ field: 'balance', message: `잔여 ${remaining}일, 요청 ${days}일` }]);
  }

  // 4. Check no duplicate for overlapping dates
  const duplicates = await db
    .select()
    .from(leaveRequests)
    .where(
      and(
        eq(leaveRequests.employeeId, employee_id),
        lte(leaveRequests.startDate, end_date),
        gte(leaveRequests.endDate, start_date),
        or(
          eq(leaveRequests.status, 'pending'),
          eq(leaveRequests.status, 'approved'),
        ),
      ),
    );

  if (duplicates.length > 0) {
    throw new AppError('LV_003', [{ field: 'dates', message: '겹치는 휴가 신청이 있습니다' }]);
  }

  // 5. Generate ID: LV-YYYY-NNNN
  const countResult = await db
    .select({ cnt: count() })
    .from(leaveRequests)
    .where(sql`EXTRACT(YEAR FROM ${leaveRequests.createdAt}) = ${year}`);
  const seq = Number(countResult[0]?.cnt ?? 0) + 1;
  const requestId = generateLeaveRequestId(year, seq);

  // 6. INSERT leave_request
  const [created] = await db
    .insert(leaveRequests)
    .values({
      id: requestId,
      employeeId: employee_id,
      leaveType: leave_type,
      startDate: start_date,
      endDate: end_date,
      days: String(days),
      reason: reason ?? null,
      status: 'pending',
      conversationId: conversation_id ?? null,
    })
    .returning();

  // 7. UPDATE leave_balances.pending_days += days
  await db
    .update(leaveBalances)
    .set({
      pendingDays: sql`${leaveBalances.pendingDays} + ${days}`,
    })
    .where(
      and(
        eq(leaveBalances.employeeId, employee_id),
        eq(leaveBalances.year, year),
        eq(leaveBalances.leaveType, leave_type),
      ),
    );

  // 8. Find employee's manager
  const manager = emp[0].managerId
    ? await db.select().from(employees).where(eq(employees.id, emp[0].managerId)).limit(1)
    : [];

  return {
    request: {
      id: created.id,
      employee_id: created.employeeId,
      leave_type: created.leaveType,
      start_date: created.startDate,
      end_date: created.endDate,
      days: Number(created.days),
      reason: created.reason,
      status: created.status,
      created_at: created.createdAt?.toISOString() ?? new Date().toISOString(),
    },
    approval: {
      approver_id: manager.length > 0 ? manager[0].id : null,
      approver_name: manager.length > 0 ? manager[0].name : null,
    },
  };
}

// ─── Cancel Leave Request ───────────────────────────────────────────────────

export async function cancelLeaveRequest(requestId: string) {
  const rows = await db
    .select()
    .from(leaveRequests)
    .where(eq(leaveRequests.id, requestId))
    .limit(1);

  if (rows.length === 0) {
    throw new AppError('LV_004', [{ field: 'id', message: '휴가 신청을 찾을 수 없습니다' }]);
  }

  const request = rows[0];

  if (request.status !== 'pending') {
    throw new AppError('LV_005', [{ field: 'status', message: `현재 상태: ${request.status}` }]);
  }

  // Update status to cancelled
  await db
    .update(leaveRequests)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(leaveRequests.id, requestId));

  // Reduce pending_days
  const year = new Date(request.startDate).getFullYear();
  await db
    .update(leaveBalances)
    .set({
      pendingDays: sql`GREATEST(${leaveBalances.pendingDays} - ${Number(request.days)}, 0)`,
    })
    .where(
      and(
        eq(leaveBalances.employeeId, request.employeeId),
        eq(leaveBalances.year, year),
        eq(leaveBalances.leaveType, request.leaveType),
      ),
    );

  return { id: requestId, status: 'cancelled' };
}

// ─── Get Leave Requests ────────────────────────────────────────────────────

export interface GetLeaveRequestsQuery {
  employee_id?: string;
  team_id?: string;
  status?: string;
  date?: string;
  page?: number;
  limit?: number;
}

export async function getLeaveRequests(query: GetLeaveRequestsQuery) {
  const { employee_id, team_id, status, date, page = 1, limit = 20 } = query;
  const conditions = [];

  if (employee_id) {
    conditions.push(eq(leaveRequests.employeeId, employee_id));
  }

  if (team_id) {
    const teamMembers = await db
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.teamId, team_id));
    if (teamMembers.length > 0) {
      const memberIds = teamMembers.map((m) => m.id);
      conditions.push(
        sql`${leaveRequests.employeeId} IN (${sql.join(memberIds.map(id => sql`${id}`), sql`, `)})`,
      );
    }
  }

  if (status) {
    conditions.push(eq(leaveRequests.status, status));
  }

  if (date) {
    conditions.push(lte(leaveRequests.startDate, date));
    conditions.push(gte(leaveRequests.endDate, date));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (page - 1) * limit;

  const rows = await db
    .select()
    .from(leaveRequests)
    .where(whereClause)
    .limit(limit + 1)
    .offset(offset);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  return {
    requests: items.map((r) => ({
      id: r.id,
      employee_id: r.employeeId,
      leave_type: r.leaveType,
      start_date: r.startDate,
      end_date: r.endDate,
      days: Number(r.days),
      reason: r.reason,
      status: r.status,
      created_at: r.createdAt?.toISOString() ?? null,
    })),
    has_more: hasMore,
    page,
  };
}

// ─── Get Holidays ───────────────────────────────────────────────────────────

export async function getHolidays(year: number) {
  const rows = await db
    .select()
    .from(holidays)
    .where(eq(holidays.year, year));

  return rows.map((h) => ({
    date: h.date,
    name: h.name,
  }));
}

// ─── Get Team Schedule ──────────────────────────────────────────────────────

export async function getTeamSchedule(teamId: string, month: string): Promise<TeamScheduleEntry[]> {
  // month is in format YYYY-MM
  const [yearStr, monthStr] = month.split('-');
  const startOfMonth = `${yearStr}-${monthStr}-01`;
  const lastDay = new Date(Number(yearStr), Number(monthStr), 0).getDate();
  const endOfMonth = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

  // Get team members
  const teamMembers = await db
    .select({ id: employees.id, name: employees.name })
    .from(employees)
    .where(eq(employees.teamId, teamId));

  if (teamMembers.length === 0) {
    return [];
  }

  const memberIds = teamMembers.map((m) => m.id);

  // Get leave requests for team members in the month
  const requests = await db
    .select()
    .from(leaveRequests)
    .where(
      and(
        sql`${leaveRequests.employeeId} IN (${sql.join(memberIds.map(id => sql`${id}`), sql`, `)})`,
        lte(leaveRequests.startDate, endOfMonth),
        gte(leaveRequests.endDate, startOfMonth),
        or(
          eq(leaveRequests.status, 'approved'),
          eq(leaveRequests.status, 'pending'),
        ),
      ),
    );

  return requests.map((r) => {
    const member = teamMembers.find((m) => m.id === r.employeeId);
    return {
      employee_id: r.employeeId,
      employee_name: member?.name ?? '',
      leave_type: r.leaveType,
      start_date: r.startDate,
      end_date: r.endDate,
      days: Number(r.days),
      status: r.status ?? 'pending',
    };
  });
}
