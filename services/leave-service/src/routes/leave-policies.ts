import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { leavePolicies } from '@palette/db';
import { db } from '../db.js';

const leavePolicyRoutes = new Hono();

// GET /api/v1/leave-policies/:id
leavePolicyRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');

  const rows = await db
    .select()
    .from(leavePolicies)
    .where(eq(leavePolicies.id, id))
    .limit(1);

  if (rows.length === 0) {
    return c.json(
      { error: { code: 'NOT_FOUND', message: '해당 휴가 정책을 찾을 수 없습니다' } },
      404,
    );
  }

  const policy = rows[0];
  return c.json({
    data: {
      id: policy.id,
      name: policy.name,
      rules: policy.rules,
      leave_types: policy.leaveTypes,
      auto_approve: policy.autoApprove,
      is_active: policy.isActive,
    },
  });
});

export default leavePolicyRoutes;
