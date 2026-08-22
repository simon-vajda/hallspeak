import type { MiddlewareHandler } from 'hono';
import { isConfigured, lookupSession } from '../../core/auth';
import { db } from '../../db';
import { readSessionCookie } from '../session-cookie';

/**
 * A Problem and never a redirect: the caller is `fetch` from the admin SPA, which turns a
 * 401 into a route guard of its own. One body for every refusal.
 */
const REFUSED = { code: 'unauthenticated', message: 'Sign in first.' } as const;

export const requireAdmin: MiddlewareHandler = async (c, next) => {
  // Before the session, not after: between a recovery restart and the finished wizard the
  // table still holds rows that correspond to no account at all.
  if (!isConfigured()) return c.json(REFUSED, 401);

  const token = readSessionCookie(c);
  if (token === undefined || !lookupSession(db, token)) return c.json(REFUSED, 401);

  await next();
};
