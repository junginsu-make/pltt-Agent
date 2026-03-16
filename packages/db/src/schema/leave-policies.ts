import { pgTable, text, jsonb, boolean, timestamp } from 'drizzle-orm/pg-core';

export const leavePolicies = pgTable('leave_policies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  rules: jsonb('rules').notNull(),
  leaveTypes: jsonb('leave_types').notNull(),
  autoApprove: jsonb('auto_approve').default({ enabled: true, timeout_hours: 2 }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
