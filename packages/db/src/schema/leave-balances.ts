import { pgTable, text, integer, numeric, date, timestamp, uuid, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const leaveBalances = pgTable('leave_balances', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  employeeId: text('employee_id').notNull(),
  year: integer('year').notNull(),
  leaveType: text('leave_type').default('annual'),
  totalDays: numeric('total_days', { precision: 4, scale: 1 }).notNull(),
  usedDays: numeric('used_days', { precision: 4, scale: 1 }).default('0'),
  pendingDays: numeric('pending_days', { precision: 4, scale: 1 }).default('0'),
  remainingDays: numeric('remaining_days', { precision: 4, scale: 1 }).generatedAlwaysAs(
    sql`total_days - used_days - pending_days`
  ),
  expiresAt: date('expires_at'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  unique('leave_balances_employee_year_type').on(table.employeeId, table.year, table.leaveType),
]);
