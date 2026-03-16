import { z } from 'zod';

// ─── Auth ────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email('유효한 이메일 주소를 입력하세요'),
  password: z.string().min(1, '비밀번호를 입력하세요'),
});

// ─── Leave ───────────────────────────────────────────────────────────────────

export const createLeaveRequestSchema = z.object({
  employeeId: z.string().min(1, '직원 ID는 필수입니다'),
  leaveType: z.enum(['annual', 'half_am', 'half_pm', 'sick', 'special'], {
    errorMap: () => ({ message: '유효하지 않은 휴가 유형입니다' }),
  }),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식은 YYYY-MM-DD입니다'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식은 YYYY-MM-DD입니다'),
  reason: z.string().optional(),
});

export const validateDatesSchema = z.object({
  employeeId: z.string().min(1, '직원 ID는 필수입니다'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식은 YYYY-MM-DD입니다'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식은 YYYY-MM-DD입니다'),
});

// ─── Approval ────────────────────────────────────────────────────────────────

export const decideApprovalSchema = z.object({
  decision: z.enum(['approved', 'rejected'], {
    errorMap: () => ({ message: '결정은 approved 또는 rejected만 가능합니다' }),
  }),
  comment: z.string().optional(),
});

// ─── Channel ─────────────────────────────────────────────────────────────────

export const createChannelSchema = z.object({
  type: z.enum(['direct', 'work', 'team', 'notification', 'company'], {
    errorMap: () => ({ message: '유효하지 않은 채널 유형입니다' }),
  }),
  name: z.string().optional(),
  participants: z.array(z.string().min(1)).min(1, '참여자가 최소 1명 필요합니다'),
  workDomain: z.string().optional(),
});

// ─── Inferred types ──────────────────────────────────────────────────────────

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;
export type ValidateDatesInput = z.infer<typeof validateDatesSchema>;
export type DecideApprovalInput = z.infer<typeof decideApprovalSchema>;
export type CreateChannelInput = z.infer<typeof createChannelSchema>;
