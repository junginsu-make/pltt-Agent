import { pgTable, text, boolean, jsonb, timestamp, uuid, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  channelId: text('channel_id').notNull(),
  senderType: text('sender_type').notNull(),
  senderUserId: text('sender_user_id'),
  displayName: text('display_name').notNull(),
  contentType: text('content_type').default('text'),
  contentText: text('content_text'),
  cardData: jsonb('card_data'),
  toolCalls: jsonb('tool_calls').default([]),
  toolResults: jsonb('tool_results').default([]),
  isLlmAuto: boolean('is_llm_auto').default(false),
  readBy: text('read_by').array().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_messages_channel').on(table.channelId, table.createdAt),
  index('idx_messages_sender').on(table.senderUserId),
]);
