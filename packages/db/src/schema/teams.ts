import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const teams = pgTable('teams', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  leaderId: text('leader_id'),
  parentId: text('parent_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
