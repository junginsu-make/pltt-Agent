// ─── Leave Accrual Job ───────────────────────────────────────────────────────
// Think of this like a payroll clerk who, on the first of every month, credits
// each employee's annual leave balance according to the company policy. New
// hires (< 1 year) get 1 day/month; veterans get their full annual grant on
// their hire anniversary. The clerk logs every credit in the accrual ledger.
//
// This job runs daily but only performs accruals on the 1st of each month.
// Running daily ensures it doesn't miss the 1st even if the server was down.

import type { JobDefinition } from './job-runner.js';
import { createServiceToken } from '@palette/shared/middleware/service-auth';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function getSchedulerHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${createServiceToken('scheduler')}`,
  };
}

interface Employee {
  id: string;
  name: string;
  hire_date: string;
  leave_policy_id: string;
}

interface LeavePolicy {
  id: string;
  name: string;
  rules: {
    first_year: {
      type: string;
      days_per_month: number;
      max_days: number;
    };
    after_one_year: {
      type: string;
      base_days: number;
      min_attendance_rate: number;
    };
    seniority_bonus: {
      start_after_years: number;
      bonus_days: number;
      every_years: number;
      max_total_days: number;
    };
  };
}

interface AccrualRequest {
  employee_id: string;
  accrual_type: string;
  days: number;
  reason: string;
}

interface AccrualResponse {
  data?: {
    employee_id: string;
    days_added: number;
    balance_after: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

function getLeaveServiceUrl(): string {
  const url = process.env.LEAVE_SERVICE_URL;
  if (!url) {
    throw new Error('LEAVE_SERVICE_URL environment variable is required');
  }
  return url;
}

export async function fetchActiveEmployees(): Promise<Employee[]> {
  const baseUrl = getLeaveServiceUrl();
  const response = await fetch(`${baseUrl}/api/v1/employees/active`, {
    headers: getSchedulerHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch active employees: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as { data: { employees: Employee[] } };
  return json.data.employees;
}

export async function fetchLeavePolicy(policyId: string): Promise<LeavePolicy> {
  const baseUrl = getLeaveServiceUrl();
  const response = await fetch(`${baseUrl}/api/v1/leave-policies/${policyId}`, {
    headers: getSchedulerHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch leave policy ${policyId}: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as { data: LeavePolicy };
  return json.data;
}

export async function postAccrual(accrual: AccrualRequest): Promise<AccrualResponse> {
  const baseUrl = getLeaveServiceUrl();
  const response = await fetch(`${baseUrl}/api/v1/leave/accrual`, {
    method: 'POST',
    headers: getSchedulerHeaders(),
    body: JSON.stringify(accrual),
  });

  const json = (await response.json()) as AccrualResponse;

  if (!response.ok) {
    console.error(`[leave-accrual] Failed to post accrual for ${accrual.employee_id}:`, json.error);
  }

  return json;
}

export function calculateAccrualDays(
  hireDate: string,
  policy: LeavePolicy,
  referenceDate: Date,
): { days: number; reason: string } | null {
  const hire = new Date(hireDate);
  const diffMs = referenceDate.getTime() - hire.getTime();
  const yearsWorked = diffMs / (365.25 * 24 * 60 * 60 * 1000);

  // First year: monthly accrual (1 day/month, max 11)
  if (yearsWorked < 1) {
    const monthsWorked = Math.floor(
      (referenceDate.getFullYear() - hire.getFullYear()) * 12 +
        (referenceDate.getMonth() - hire.getMonth()),
    );

    if (monthsWorked <= 0) {
      return null;
    }

    if (monthsWorked > policy.rules.first_year.max_days) {
      return null;
    }

    return {
      days: policy.rules.first_year.days_per_month,
      reason: `월별 자동 발생 (입사 ${monthsWorked}개월차)`,
    };
  }

  // After one year: annual grant on the 1st of January only
  // (or on hire anniversary month — using January for simplicity in MVP)
  if (referenceDate.getMonth() !== 0) {
    // Only grant on January 1st for annual grants
    return null;
  }

  const fullYears = Math.floor(yearsWorked);
  let totalDays = policy.rules.after_one_year.base_days;

  // Seniority bonus
  const { start_after_years, bonus_days, every_years, max_total_days } =
    policy.rules.seniority_bonus;
  if (fullYears >= start_after_years) {
    const bonusYears = fullYears - start_after_years;
    const bonusCycles = Math.floor(bonusYears / every_years) + 1;
    totalDays += bonusCycles * bonus_days;
  }

  totalDays = Math.min(totalDays, policy.rules.seniority_bonus.max_total_days);

  return {
    days: totalDays,
    reason: `연간 자동 발생 (근속 ${fullYears}년차, ${totalDays}일)`,
  };
}

export async function runLeaveAccrualJob(): Promise<void> {
  const now = new Date();
  const dayOfMonth = now.getDate();

  if (dayOfMonth !== 1) {
    console.log(`[leave-accrual] Not the 1st of the month (day=${dayOfMonth}), skipping`);
    return;
  }

  console.log(`[leave-accrual] Running monthly accrual for ${now.toISOString().slice(0, 7)}...`);

  const employees = await fetchActiveEmployees();
  console.log(`[leave-accrual] Found ${employees.length} active employee(s)`);

  // Group employees by policy to avoid redundant fetches
  const policyCache = new Map<string, LeavePolicy>();

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (const employee of employees) {
    try {
      let policy = policyCache.get(employee.leave_policy_id);
      if (!policy) {
        policy = await fetchLeavePolicy(employee.leave_policy_id);
        policyCache.set(employee.leave_policy_id, policy);
      }

      const accrual = calculateAccrualDays(employee.hire_date, policy, now);

      if (!accrual) {
        skipCount += 1;
        continue;
      }

      const result = await postAccrual({
        employee_id: employee.id,
        accrual_type: 'monthly_auto',
        days: accrual.days,
        reason: accrual.reason,
      });

      if (result.data) {
        successCount += 1;
        console.log(
          `[leave-accrual] Accrued ${accrual.days} day(s) for ${employee.name} (${employee.id}): ${accrual.reason}`,
        );
      } else {
        failCount += 1;
      }
    } catch (error) {
      failCount += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[leave-accrual] Error processing ${employee.id}:`, message);
    }
  }

  console.log(
    `[leave-accrual] Done: ${successCount} accrued, ${skipCount} skipped, ${failCount} failed`,
  );
}

export function createLeaveAccrualJob(): JobDefinition {
  return {
    name: 'leave-accrual',
    description: 'Monthly leave accrual on the 1st of each month based on leave policies',
    intervalMs: ONE_DAY_MS,
    handler: runLeaveAccrualJob,
  };
}
