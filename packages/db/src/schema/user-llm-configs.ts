import { pgTable, text, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const userLlmConfigs = pgTable('user_llm_configs', {
  userId: text('user_id').primaryKey(),
  llmRole: text('llm_role').notNull(),
  systemPrompt: text('system_prompt').notNull(),
  llmModel: text('llm_model').default('claude-haiku-4-5-20251001'),
  autoRespond: boolean('auto_respond').default(true),
  tools: jsonb('tools').default([]),
  workDomains: text('work_domains').array().default([]),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
