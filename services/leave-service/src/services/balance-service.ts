import { eq, and } from 'drizzle-orm';
import { db } from '../db.js';
import { leaveBalances, employees } from '@palette/db';
import { AppError } from '@palette/shared';

export interface BalanceItem {
  leave_type: string;
  total_days: number;
  used_days: number;
  pending_days: number;
  remaining_days: number;
  expires_at: string | null;
}

export interface BalanceResponse {
  employee_id: string;
  year: number;
  balances: BalanceItem[];
}

export async function getLeaveBalance(employeeId: string, year: number): Promise<BalanceResponse> {
  // Verify employee exists
  const employee = await db
    .select()
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);

  if (employee.length === 0) {
    throw new AppError('LV_004', [{ field: 'employee_id', message: '직원을 찾을 수 없습니다' }]);
  }

  // Get balances for the year
  const balances = await db
    .select()
    .from(leaveBalances)
    .where(
      and(
        eq(leaveBalances.employeeId, employeeId),
        eq(leaveBalances.year, year),
      ),
    );

  const balanceItems: BalanceItem[] = balances.map((b) => ({
    leave_type: b.leaveType ?? 'annual',
    total_days: Number(b.totalDays),
    used_days: Number(b.usedDays ?? 0),
    pending_days: Number(b.pendingDays ?? 0),
    remaining_days: Number(b.remainingDays ?? 0),
    expires_at: b.expiresAt,
  }));

  return {
    employee_id: employeeId,
    year,
    balances: balanceItems,
  };
}
