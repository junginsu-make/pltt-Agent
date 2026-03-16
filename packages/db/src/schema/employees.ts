import { pgTable, text, date, timestamp } from 'drizzle-orm/pg-core';

export const employees = pgTable('employees', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  teamId: text('team_id'),
  position: text('position'),
  grade: text('grade'),
  managerId: text('manager_id'),
  hireDate: date('hire_date').notNull(),
  leavePolicyId: text('leave_policy_id').default('LP-DEFAULT'),
  status: text('status').default('active'),
  messengerStatus: text('messenger_status').default('offline'),
  telegramId: text('telegram_id'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
