import { pgTable, text, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const channels = pgTable('channels', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  name: text('name'),
  workDomain: text('work_domain'),
  assignedLlm: text('assigned_llm'),
  humanTakeover: boolean('human_takeover').default(false),
  takeoverBy: text('takeover_by'),
  participants: text('participants').array().notNull(),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
