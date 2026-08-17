import type { Context, MiddlewareHandler } from 'hono';
import { TokenBucketLimiter } from '../../lib/rate-limit';

/** The whole server shares one budget behind the per-IP one, so it needs one key. */
const SHARED_KEY = '*';

function clientIp(c: Context): string {
  const incoming = (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)
    ?.incoming;
  // 'unknown' collapses every unidentifiable caller into one bucket, throttling them
  // together rather than exempting them.
  return incoming?.socket?.remoteAddress ?? 'unknown';
}

/**
 * Charged on 404 responses only, so a room full of guests never feels it and only a
 * caller that is guessing pays.
 */
export function createRateLimit(limiters: {
  perIp: TokenBucketLimiter;
  shared: TokenBucketLimiter;
}): MiddlewareHandler {
  return async (c, next) => {
    const ip = clientIp(c);

    const wait = !limiters.perIp.allow(ip)
      ? limiters.perIp.retryAfter(ip)
      : !limiters.shared.allow(SHARED_KEY)
        ? limiters.shared.retryAfter(SHARED_KEY)
        : 0;

    if (wait > 0) {
      c.header('Retry-After', String(wait));
      return c.json({ code: 'rate_limited', message: 'Too many failed lookups.' }, 429);
    }

    await next();

    if (c.res.status === 404) {
      limiters.perIp.penalize(ip);
      limiters.shared.penalize(SHARED_KEY);
    }
  };
}

/**
 * Burst 20 refilling at 1/s puts a sweep of the 6-digit space at roughly eleven days,
 * while a guest who mistypes twice never notices. The shared budget behind it is for
 * botnets, which sidestep a per-IP limit entirely.
 */
export const publicRateLimit = createRateLimit({
  perIp: new TokenBucketLimiter({ capacity: 20, refillPerSecond: 1 }),
  shared: new TokenBucketLimiter({ capacity: 200, refillPerSecond: 10 }),
});
