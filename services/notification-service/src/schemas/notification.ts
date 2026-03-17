import { z } from 'zod';

export const NotificationType = z.enum([
  'leave_approved',
  'leave_rejected',
  'leave_requested',
  'approval_needed',
  'system',
  'mention',
  'takeover',
]);

export type NotificationType = z.infer<typeof NotificationType>;

export const createNotificationSchema = z.object({
  userId: z.string().min(1, '사용자 ID는 필수입니다'),
  type: NotificationType,
  title: z.string().min(1, '제목은 필수입니다').max(200),
  message: z.string().min(1, '메시지는 필수입니다').max(2000),
  data: z.record(z.unknown()).optional(),
  sourceUserId: z.string().optional(),
});

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;

export const getNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: NotificationType.optional(),
  unreadOnly: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
});

export type GetNotificationsQuery = z.infer<typeof getNotificationsQuerySchema>;

export const markAllReadSchema = z.object({
  userId: z.string().min(1, '사용자 ID는 필수입니다'),
});

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  sourceUserId?: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}
