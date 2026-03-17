import type { Context, Next } from 'hono';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimiterOptions {
  windowMs?: number;
  maxRequests?: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup expired entries every 60s
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}, 60_000);

export function rateLimiter(options: RateLimiterOptions = {}): (c: Context, next: Next) => Promise<Response | void> {
  const windowMs = options.windowMs ?? 60_000;
  const maxRequests = options.maxRequests ?? 100;

  return async (c: Context, next: Next): Promise<Response | void> => {
    const ip = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown';
    const key = `${ip}:${c.req.path}`;
    const now = Date.now();

    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      c.header('X-RateLimit-Limit', String(maxRequests));
      c.header('X-RateLimit-Remaining', String(maxRequests - 1));
      await next();
      return;
    }

    if (entry.count >= maxRequests) {
      c.header('X-RateLimit-Limit', String(maxRequests));
      c.header('X-RateLimit-Remaining', '0');
      c.header('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return c.json(
        { error: { code: 'SYS_002', message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' } },
        429,
      );
    }

    entry.count += 1;
    c.header('X-RateLimit-Limit', String(maxRequests));
    c.header('X-RateLimit-Remaining', String(maxRequests - entry.count));
    await next();
  };
}
