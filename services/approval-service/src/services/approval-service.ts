import { eq, and, desc, ne, lte, count, sql } from 'drizzle-orm';
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

  // Calculate auto_approve_at
  const autoApproveAt = input.autoApproveHours
    ? new Date(now.getTime() + input.autoApproveHours * 60 * 60 * 1000)
    : null;

  // Atomic: count → insert → audit log
  const created = await db.transaction(async (tx) => {
    // Get count of approvals this year (efficient count query instead of full table scan)
    const countResult = await tx
      .select({ cnt: count() })
      .from(approvals)
      .where(sql`${approvals.id} LIKE ${'APR-' + year + '-%'}`);
    const seq = Number(countResult[0]?.cnt ?? 0) + 1;
    const id = generateApprovalId(year, seq);

    const result = await tx
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

    const inserted = result[0];

    // Write audit log within transaction
    await createAuditLogEntry(tx as unknown as Database, {
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

    return inserted;
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

  // 5-6: Atomic transaction for update + audit log
  const now = new Date();
  const updatedApproval = await db.transaction(async (tx) => {
    const updated = await tx
      .update(approvals)
      .set({
        status: input.decision,
        reviewComment: input.comment ?? null,
        completedAt: now,
      })
      .where(eq(approvals.id, id))
      .returning();

    await createAuditLogEntry(tx as unknown as Database, {
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

    return updated[0];
  });

  return {
    data: {
      approval_id: updatedApproval.id,
      status: updatedApproval.status,
      completed_at: updatedApproval.completedAt?.toISOString() ?? null,
    },
  };
}

export async function getExpiredApprovals(db: Database) {
  const now = new Date();
  const results = await db
    .select()
    .from(approvals)
    .where(and(eq(approvals.status, 'pending'), lte(approvals.autoApproveAt, now)))
    .orderBy(desc(approvals.createdAt));

  return results.map(toSnakeCaseResponse);
}

export async function getApprovalHistory(db: Database, approverId: string) {
  const results = await db
    .select()
    .from(approvals)
    .where(and(eq(approvals.approverId, approverId), ne(approvals.status, 'pending')))
    .orderBy(desc(approvals.completedAt));

  return results.map(toSnakeCaseResponse);
}
