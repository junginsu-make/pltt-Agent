import { eq, and, desc, ne } from 'drizzle-orm';
import { approvals } from '@palette/db';
import { generateApprovalId } from '@palette/shared';
import type { Database } from '../db.js';
import { createAuditLogEntry } from './audit-service.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CreateApprovalInput {
  type: string;
  relatedId: string;
  requestedBy: string;
  approverId: string;
  requestSummary: string;
  autoApproveHours?: number;
}

export interface DecideApprovalInput {
  decision: 'approved' | 'rejected';
  decidedBy: string;
  comment?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function toSnakeCaseResponse(approval: typeof approvals.$inferSelect) {
  return {
    id: approval.id,
    type: approval.type,
    related_id: approval.relatedId,
    requested_by: approval.requestedBy,
    approver_id: approval.approverId,
    status: approval.status,
    request_summary: approval.requestSummary,
    review_comment: approval.reviewComment,
    auto_approve_at: approval.autoApproveAt?.toISOString() ?? null,
    created_at: approval.createdAt?.toISOString() ?? null,
    completed_at: approval.completedAt?.toISOString() ?? null,
  };
}

// ─── Service ────────────────────────────────────────────────────────────────

export async function createApproval(db: Database, input: CreateApprovalInput) {
  const now = new Date();
  const year = now.getFullYear();

  // Get count of approvals this year for sequence number
  const existing = await db
    .select()
    .from(approvals)
    .orderBy(desc(approvals.createdAt));

  // Find the max sequence number from existing IDs for this year
  const prefix = `APR-${year}-`;
  let maxSeq = 0;
  for (const row of existing) {
    if (row.id.startsWith(prefix)) {
      const seq = parseInt(row.id.replace(prefix, ''), 10);
      if (seq > maxSeq) maxSeq = seq;
    }
  }

  const id = generateApprovalId(year, maxSeq + 1);

  // Calculate auto_approve_at
  const autoApproveAt = input.autoApproveHours
    ? new Date(now.getTime() + input.autoApproveHours * 60 * 60 * 1000)
    : null;

  const result = await db
    .insert(approvals)
    .values({
      id,
      type: input.type,
      relatedId: input.relatedId,
      requestedBy: input.requestedBy,
      approverId: input.approverId,
      status: 'pending',
      requestSummary: input.requestSummary,
      autoApproveAt,
    })
    .returning();

  const created = result[0];

  // Write audit log
  await createAuditLogEntry(db, {
    actor: input.requestedBy,
    action: 'approval.created',
    targetType: 'approval',
    targetId: id,
    details: {
      type: input.type,
      relatedId: input.relatedId,
      approverId: input.approverId,
    },
  });

  return {
    id: created.id,
    status: created.status,
    approver_id: created.approverId,
    auto_approve_at: created.autoApproveAt?.toISOString() ?? null,
  };
}

export async function getApprovalById(db: Database, id: string) {
  const results = await db
    .select()
    .from(approvals)
    .where(eq(approvals.id, id));

  if (results.length === 0) {
    return null;
  }

  return toSnakeCaseResponse(results[0]);
}

export async function getPendingApprovals(db: Database, approverId: string) {
  const results = await db
    .select()
    .from(approvals)
    .where(and(eq(approvals.approverId, approverId), eq(approvals.status, 'pending')))
    .orderBy(desc(approvals.createdAt));

  return results.map(toSnakeCaseResponse);
}

export async function decideApproval(db: Database, id: string, input: DecideApprovalInput) {
  // 1. Find approval
  const results = await db
    .select()
    .from(approvals)
    .where(eq(approvals.id, id));

  if (results.length === 0) {
    return { error: 'not_found' as const };
  }

  const approval = results[0];

  // 2. Check if already decided
  if (approval.status !== 'pending') {
    return { error: 'already_decided' as const };
  }

  // 3. Check if the user is the approver
  if (approval.approverId !== input.decidedBy) {
    return { error: 'not_approver' as const };
  }

  // 4. If rejected, require comment
  if (input.decision === 'rejected' && (!input.comment || input.comment.trim() === '')) {
    return { error: 'comment_required' as const };
  }

  // 5. Update the approval
  const now = new Date();
  const updated = await db
    .update(approvals)
    .set({
      status: input.decision,
      reviewComment: input.comment ?? null,
      completedAt: now,
    })
    .where(eq(approvals.id, id))
    .returning();

  const updatedApproval = updated[0];

  // 6. Create audit log entry with hash chain
  await createAuditLogEntry(db, {
    actor: input.decidedBy,
    action: `approval.${input.decision}`,
    targetType: 'approval',
    targetId: id,
    details: {
      decision: input.decision,
      comment: input.comment ?? null,
      relatedId: approval.relatedId,
    },
  });

  return {
    data: {
      approval_id: updatedApproval.id,
      status: updatedApproval.status,
      completed_at: updatedApproval.completedAt?.toISOString() ?? null,
    },
  };
}

export async function getApprovalHistory(db: Database, approverId: string) {
  const results = await db
    .select()
    .from(approvals)
    .where(and(eq(approvals.approverId, approverId), ne(approvals.status, 'pending')))
    .orderBy(desc(approvals.completedAt));

  return results.map(toSnakeCaseResponse);
}
