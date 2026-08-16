import type { Context, MiddlewareHandler } from 'hono';
import { TokenBucketLimiter } from '../../lib/rate-limit';

/** The whole server shares one budget behind the per-IP one, so it needs one key. */
const SHARED_KEY = '*';

function clientIp(c: Context): string {
  const incoming = (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)
    ?.incoming;
  // 'unknown' collapses every caller the runtime cannot identify into a single bucket,
  // which is the conservative direction: it throttles them together rather than
  // exempting them.
  return incoming?.socket?.remoteAddress ?? 'unknown';
}

/**
 * Metered on 404 responses only. A successful lookup — the thing a room full of guests
 * does — is never charged, so the limiter is invisible to legitimate use and expensive
 * only to a caller that is guessing.
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
 * Burst 20 refilling at 1/second caps a scanner at one guess per second — turning a
 * sweep of the 6-digit space from minutes into roughly eleven days — while a guest who
 * mistypes twice never notices. The shared budget sits behind it because a botnet
 * sidesteps per-IP limits entirely. In-memory state is correct here precisely because
 * the deployment target is a single process (spec E §6).
 */
export const publicRateLimit = createRateLimit({
  perIp: new TokenBucketLimiter({ capacity: 20, refillPerSecond: 1 }),
  shared: new TokenBucketLimiter({ capacity: 200, refillPerSecond: 10 }),
});
