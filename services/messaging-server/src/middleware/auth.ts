import type { Context, Next } from 'hono';
import { verifyToken } from '../lib/jwt.js';

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: { code: 'AUTH_001', message: '로그인이 필요합니다' } }, 401);
  }
  try {
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    c.set('user', payload);
    await next();
  } catch {
    return c.json({ error: { code: 'AUTH_001', message: '토큰이 만료되었거나 유효하지 않습니다' } }, 401);
  }
}
