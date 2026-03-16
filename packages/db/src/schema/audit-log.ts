import { pgTable, text, jsonb, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
  actor: text('actor').notNull(),
  action: text('action').notNull(),
  targetType: text('target_type'),
  targetId: text('target_id'),
  details: jsonb('details').notNull().default({}),
  prevHash: text('prev_hash'),
  hash: text('hash').notNull(),
});
