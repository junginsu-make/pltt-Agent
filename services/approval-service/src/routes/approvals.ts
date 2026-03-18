import { Hono } from 'hono';
import { z } from 'zod';
import { AppError } from '@palette/shared';
import { getDb } from '../db.js';
import {
  createApproval,
  getApprovalById,
  getPendingApprovals,
  decideApproval,
  getApprovalHistory,
  getExpiredApprovals,
} from '../services/approval-service.js';

// ─── Validation Schemas ─────────────────────────────────────────────────────

const createApprovalSchema = z.object({
  type: z.string().min(1, 'type은 필수입니다'),
  related_id: z.string().min(1, 'related_id는 필수입니다'),
  requested_by: z.string().min(1, 'requested_by는 필수입니다'),
  approver_id: z.string().min(1, 'approver_id는 필수입니다'),
  request_summary: z.string().min(1, 'request_summary는 필수입니다'),
  auto_approve_hours: z.number().optional(),
});

const decideApprovalSchema = z.object({
  decision: z.enum(['approved', 'rejected'], {
    errorMap: () => ({ message: '결정은 approved 또는 rejected만 가능합니다' }),
  }),
  decided_by: z.string().min(1, 'decided_by는 필수입니다'),
  comment: z.string().optional(),
});

// ─── Routes ─────────────────────────────────────────────────────────────────

const approvalRoutes = new Hono();

// POST /api/v1/approvals - Create a new approval request
approvalRoutes.post('/', async (c) => {
  const body = await c.req.json();

  const parsed = createApprovalSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: '입력값이 올바르지 않습니다',
          details: parsed.error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
      },
      400,
    );
  }

  const db = getDb();
  const result = await createApproval(db, {
    type: parsed.data.type,
    relatedId: parsed.data.related_id,
    requestedBy: parsed.data.requested_by,
    approverId: parsed.data.approver_id,
    requestSummary: parsed.data.request_summary,
    autoApproveHours: parsed.data.auto_approve_hours,
  });

  return c.json({ data: result }, 201);
});

// GET /api/v1/approvals/expired - Get expired (auto-approvable) approvals
approvalRoutes.get('/expired', async (c) => {
  const db = getDb();
  const results = await getExpiredApprovals(db);
  return c.json({ data: { approvals: results } });
});

// GET /api/v1/approvals/pending/:approverId - Get pending approvals
approvalRoutes.get('/pending/:approverId', async (c) => {
  const approverId = c.req.param('approverId');
  const db = getDb();
  const results = await getPendingApprovals(db, approverId);
  return c.json({ data: { approvals: results } });
});

// GET /api/v1/approvals/history/:approverId - Get approval history
approvalRoutes.get('/history/:approverId', async (c) => {
  const approverId = c.req.param('approverId');
  const db = getDb();
  const results = await getApprovalHistory(db, approverId);
  return c.json({ data: { approvals: results } });
});

// GET /api/v1/approvals/:id - Get approval by ID
approvalRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const db = getDb();
  const approval = await getApprovalById(db, id);

  if (!approval) {
    return c.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: '해당 승인 요청을 찾을 수 없습니다',
        },
      },
      404,
    );
  }

  return c.json({ data: approval });
});

// PATCH /api/v1/approvals/:id/decide - Approve or reject
approvalRoutes.patch('/:id/decide', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();

  const parsed = decideApprovalSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: '입력값이 올바르지 않습니다',
          details: parsed.error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
      },
      400,
    );
  }

  const db = getDb();
  const result = await decideApproval(db, id, {
    decision: parsed.data.decision,
    decidedBy: parsed.data.decided_by,
    comment: parsed.data.comment,
  });

  if ('error' in result) {
    switch (result.error) {
      case 'not_found':
        return c.json(
          { error: { code: 'NOT_FOUND', message: '해당 승인 요청을 찾을 수 없습니다' } },
          404,
        );
      case 'already_decided': {
        const err = new AppError('AP_001');
        return c.json(err.toResponse(), 400);
      }
      case 'not_approver': {
        const err = new AppError('AP_002');
        return c.json(err.toResponse(), 403);
      }
      case 'comment_required':
        return c.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: '반려 시 사유를 입력해주세요',
            },
          },
          400,
        );
    }
  }

  return c.json({ data: result.data });
});

export default approvalRoutes;
