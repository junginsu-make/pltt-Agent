import type { Context, Next } from 'hono';
import jwt from 'jsonwebtoken';

function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
}

export interface UserJwtPayload {
  employeeId: string;
  email: string;
  name: string;
  teamId: string;
}

export interface ServiceJwtPayload {
  sub: 'service';
  service: string;
  iss: 'palette-internal';
}

export type AuthPayload =
  | { type: 'user'; payload: UserJwtPayload }
  | { type: 'service'; payload: ServiceJwtPayload };

export function createServiceToken(serviceName: string): string {
  const secret = requireJwtSecret();
  const payload: ServiceJwtPayload = {
    sub: 'service',
    service: serviceName,
    iss: 'palette-internal',
  };
  return jwt.sign(payload, secret, { expiresIn: '1h' });
}

function isServicePayload(decoded: Record<string, unknown>): boolean {
  return decoded.sub === 'service' && decoded.iss === 'palette-internal' && typeof decoded.service === 'string';
}

export function serviceAuthMiddleware() {
  return async (c: Context, next: Next): Promise<Response | void> => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: { code: 'AUTH_001', message: '인증이 필요합니다' } }, 401);
    }

    const token = authHeader.slice(7);
    const secret = requireJwtSecret();

    try {
      const decoded = jwt.verify(token, secret) as Record<string, unknown>;

      if (isServicePayload(decoded)) {
        c.set('auth', { type: 'service', payload: decoded as unknown as ServiceJwtPayload } as AuthPayload);
      } else {
        const userPayload = decoded as unknown as UserJwtPayload;
        c.set('auth', { type: 'user', payload: userPayload } as AuthPayload);
        c.set('user', decoded);
      }

      await next();
    } catch {
      return c.json({ error: { code: 'AUTH_001', message: '토큰이 만료되었거나 유효하지 않습니다' } }, 401);
    }
  };
}
