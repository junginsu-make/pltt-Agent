import { Hono } from 'hono';
import { getLeaveBalance } from '../services/balance-service.js';
import {
  validateDate,
  createLeaveRequest,
  cancelLeaveRequest,
  getHolidays,
  getTeamSchedule,
  getLeaveRequests,
  accrueLeave,
  accrualInputSchema,
} from '../services/leave-service.js';

const leave = new Hono();

// GET /requests
leave.get('/requests', async (c) => {
  const result = await getLeaveRequests({
    employee_id: c.req.query('employee_id'),
    team_id: c.req.query('team_id'),
    status: c.req.query('status'),
    date: c.req.query('date'),
    page: c.req.query('page') ? Number(c.req.query('page')) : undefined,
    limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
  });
  return c.json({ data: result });
});

// GET /balance/:employeeId
leave.get('/balance/:employeeId', async (c) => {
  const employeeId = c.req.param('employeeId');
  const year = Number(c.req.query('year') ?? new Date().getFullYear());
  const result = await getLeaveBalance(employeeId, year);
  return c.json({ data: result });
});

// POST /validate-date
leave.post('/validate-date', async (c) => {
  const body = await c.req.json();
  const result = await validateDate({
    employee_id: body.employee_id,
    date: body.date,
    leave_type: body.leave_type,
  });
  return c.json({ data: result });
});

// POST /request
leave.post('/request', async (c) => {
  const body = await c.req.json();
  const result = await createLeaveRequest({
    employee_id: body.employee_id,
    leave_type: body.leave_type,
    start_date: body.start_date,
    end_date: body.end_date,
    days: body.days,
    reason: body.reason,
    conversation_id: body.conversation_id,
  });
  return c.json({ data: { type: 'leave_request_confirmation', ...result } }, 201);
});

// DELETE /request/:id
leave.delete('/request/:id', async (c) => {
  const id = c.req.param('id');
  const result = await cancelLeaveRequest(id);
  return c.json({ data: result });
});

// GET /holidays
leave.get('/holidays', async (c) => {
  const year = Number(c.req.query('year') ?? new Date().getFullYear());
  const result = await getHolidays(year);
  return c.json({ data: result });
});

// POST /accrual
leave.post('/accrual', async (c) => {
  const body = await c.req.json();

  const parsed = accrualInputSchema.safeParse(body);
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

  const result = await accrueLeave(parsed.data);
  return c.json({ data: result }, 201);
});

// GET /team-schedule
leave.get('/team-schedule', async (c) => {
  const teamId = c.req.query('teamId');
  const month = c.req.query('month');

  if (!teamId || !month) {
    return c.json(
      { error: { code: 'VALIDATION', message: 'teamId와 month는 필수입니다' } },
      400,
    );
  }

  const result = await getTeamSchedule(teamId, month);
  return c.json({ data: result });
});

export default leave;
