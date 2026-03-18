import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { employees } from '@palette/db';
import { db } from '../db.js';

const employeeRoutes = new Hono();

// GET /api/v1/employees/active
employeeRoutes.get('/active', async (c) => {
  const rows = await db
    .select({
      id: employees.id,
      name: employees.name,
      hire_date: employees.hireDate,
      leave_policy_id: employees.leavePolicyId,
    })
    .from(employees)
    .where(eq(employees.status, 'active'));

  return c.json({ data: { employees: rows } });
});

export default employeeRoutes;
