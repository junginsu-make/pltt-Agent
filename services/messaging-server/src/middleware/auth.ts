import type { Context, Next } from 'hono';
import jwt from 'jsonwebtoken';
import { verifyToken } from '../lib/jwt.js';

function isServiceToken(decoded: Record<string, unknown>): boolean {
  return decoded.sub === 'service' && decoded.iss === 'palette-internal';
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: { code: 'AUTH_001', message: '로그인이 필요합니다' } }, 401);
  }

  const token = authHeader.slice(7);

  // Try user token first
  try {
    const payload = verifyToken(token);
    c.set('user', payload);
    await next();
    return;
  } catch {
    // User token failed — try service token fallback
  }

  // Service token fallback
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return c.json({ error: { code: 'AUTH_001', message: '서버 설정 오류' } }, 500);
    }
    const decoded = jwt.verify(token, secret) as Record<string, unknown>;
    if (isServiceToken(decoded)) {
      c.set('auth', { type: 'service', payload: decoded });
      await next();
      return;
    }
    return c.json({ error: { code: 'AUTH_001', message: '토큰이 만료되었거나 유효하지 않습니다' } }, 401);
  } catch {
    return c.json({ error: { code: 'AUTH_001', message: '토큰이 만료되었거나 유효하지 않습니다' } }, 401);
  }
}
