import { Hono } from 'hono';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db, employees } from '@palette/db';
import { eq } from 'drizzle-orm';
import { signToken } from '../lib/jwt.js';

const auth = new Hono();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

auth.post('/login', async (c) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: 'AUTH_001',
          message: '이메일과 비밀번호를 확인해주세요',
          details: parsed.error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
      },
      400
    );
  }

  const { email, password } = parsed.data;

  // Look up employee by email
  const result = await db
    .select()
    .from(employees)
    .where(eq(employees.email, email))
    .limit(1);

  const employee = result[0];

  if (!employee) {
    return c.json(
      { error: { code: 'AUTH_001', message: '이메일 또는 비밀번호가 올바르지 않습니다' } },
      401
    );
  }

  // Compare password
  const passwordValid = await bcrypt.compare(password, employee.passwordHash);
  if (!passwordValid) {
    return c.json(
      { error: { code: 'AUTH_001', message: '이메일 또는 비밀번호가 올바르지 않습니다' } },
      401
    );
  }

  // Generate JWT
  const token = signToken({
    employeeId: employee.id,
    email: employee.email,
    name: employee.name,
    teamId: employee.teamId ?? '',
  });

  return c.json({
    token,
    employee: {
      id: employee.id,
      name: employee.name,
      email: employee.email,
      teamId: employee.teamId,
      position: employee.position,
      managerId: employee.managerId,
      avatarUrl: employee.avatarUrl,
    },
  });
});

export default auth;
