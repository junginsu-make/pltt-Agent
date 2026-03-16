import type { Employee, ChannelType } from './index.js';

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  employee: Employee;
}

// ─── Leave ───────────────────────────────────────────────────────────────────

export interface LeaveBalanceResponse {
  employeeId: string;
  year: number;
  totalDays: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
}

export interface CreateLeaveRequest {
  employeeId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason?: string;
}

export interface ValidateDatesRequest {
  employeeId: string;
  startDate: string;
  endDate: string;
}

export interface ValidateDatesResponse {
  valid: boolean;
  businessDays: number;
  weekends: number;
  holidays: string[];
  conflicts: string[];
}

// ─── Approval ────────────────────────────────────────────────────────────────

export interface CreateApprovalRequest {
  type: string;
  relatedId: string;
  requestedBy: string;
  approverId: string;
  requestSummary: string;
}

export interface DecideApprovalRequest {
  decision: 'approved' | 'rejected';
  comment?: string;
}

// ─── Channel ─────────────────────────────────────────────────────────────────

export interface CreateChannelRequest {
  type: ChannelType;
  name?: string;
  participants: string[];
  workDomain?: string;
}

// ─── Pagination ──────────────────────────────────────────────────────────────

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
