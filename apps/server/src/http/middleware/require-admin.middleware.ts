import type { MiddlewareHandler } from 'hono';
import { isConfigured, lookupSession } from '../../core/auth';
import { db } from '../../db';
import { readSessionCookie, setSessionCookie } from '../session-cookie';

/**
 * A Problem and never a redirect: the caller is `fetch` from the admin SPA, which turns a
 * 401 into a route guard of its own. One body for every refusal.
 */
const REFUSED = { code: 'unauthenticated', message: 'Sign in first.' } as const;

export const requireAdmin: MiddlewareHandler = async (c, next) => {
  // Before the session, not after: between a recovery restart and the finished wizard the
  // table still holds rows that correspond to no account at all.
  if (!isConfigured()) {
    return c.json(REFUSED, 401);
  }

  const token = readSessionCookie(c);
  if (token === undefined) {
    return c.json(REFUSED, 401);
  }

  const session = lookupSession(db, token);
  if (session === 'unknown') {
    return c.json(REFUSED, 401);
  }
  // The row rolled forward; the browser's Max-Age has to follow it or the cookie expires
  // 30 days after sign-in however active the administrator has been. Same token — this is
  // a lifetime refresh, not a rotation, and it costs one Set-Cookie a day.
  if (session === 'renewed') {
    setSessionCookie(c, token);
  }

  await next();
};
