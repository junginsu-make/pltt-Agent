import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const approvals = pgTable('approvals', {
  id: text('id').primaryKey(),
  type: text('type').notNull().default('leave_request'),
  relatedId: text('related_id').notNull(),
  requestedBy: text('requested_by').notNull(),
  approverId: text('approver_id').notNull(),
  status: text('status').default('pending'),
  requestSummary: text('request_summary').notNull(),
  llmReasoning: text('llm_reasoning'),
  reviewComment: text('review_comment'),
  autoApproveAt: timestamp('auto_approve_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});
