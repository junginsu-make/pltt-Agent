import { pgTable, text, date, numeric, timestamp } from 'drizzle-orm/pg-core';

export const leaveRequests = pgTable('leave_requests', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull(),
  leaveType: text('leave_type').notNull().default('annual'),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  days: numeric('days', { precision: 4, scale: 1 }).notNull(),
  reason: text('reason'),
  status: text('status').default('pending'),
  approvalId: text('approval_id'),
  conversationId: text('conversation_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
