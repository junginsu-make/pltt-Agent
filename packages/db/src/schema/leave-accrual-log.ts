import { pgTable, text, numeric, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const leaveAccrualLog = pgTable('leave_accrual_log', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  employeeId: text('employee_id').notNull(),
  accrualType: text('accrual_type').notNull(),
  days: numeric('days', { precision: 4, scale: 1 }).notNull(),
  reason: text('reason').notNull(),
  balanceAfter: numeric('balance_after', { precision: 4, scale: 1 }),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
