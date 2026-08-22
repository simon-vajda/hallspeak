import { OpenAPIHono } from '@hono/zod-openapi';
import * as routes from '@linguacast/contract/routes';
import {
  createAccount,
  createSession,
  deleteAllSessions,
  deleteSession,
  isConfigured,
  lookupSession,
  verifyCredentials,
} from '../../core/auth';
import { db } from '../../db';
import { AppError } from '../../lib/problem';
import { defaultHook } from '../default-hook';
import { signInRateLimit } from '../middleware/rate-limit.middleware';
import { clearSessionCookie, readSessionCookie, setSessionCookie } from '../session-cookie';

/** One body for a wrong username and a wrong password alike. */
const REFUSED = {
  code: 'invalid_credentials',
  message: 'Those credentials do not match.',
} as const;

const app = new OpenAPIHono({ defaultHook });

// Two statements rather than one '/auth/*' mount: the session read runs on every page load
// and must never be throttled. `.use()` returns a plain Hono with no `.openapi()`.
app.use('/auth/login', signInRateLimit);
app.use('/auth/setup', signInRateLimit);

function authenticated(c: Parameters<Parameters<typeof app.openapi>[1]>[0]): boolean {
  const token = readSessionCookie(c);
  // KTD10: between a recovery restart and the finished wizard the table still holds rows
  // that correspond to no account at all.
  return isConfigured() && token !== undefined && lookupSession(db, token) !== 'unknown';
}

export const authRoutes = app
  .openapi(routes.getSessionState, (c) =>
    c.json({ configured: isConfigured(), authenticated: authenticated(c) }, 200),
  )
  .openapi(routes.setupAdmin, async (c) => {
    const { username, password } = c.req.valid('json');
    if (isConfigured()) {
      return c.json(
        { code: 'already_configured', message: 'This server already has an administrator.' },
        409,
      );
    }

    try {
      await createAccount(username, password);
    } catch (err) {
      // Only the claim, and nothing else: a credential file that could not be written is a
      // failure, and reporting it as "already configured" would send the installer looking
      // for an account that does not exist.
      if (!(err instanceof AppError) || err.code !== 'already_configured') throw err;
      return c.json(
        { code: 'already_configured', message: 'This server already has an administrator.' },
        409,
      );
    }

    // Before the session below: a browser signed in before a recovery must be signed out
    // after it.
    deleteAllSessions(db);
    setSessionCookie(c, createSession(db));
    return c.json({ configured: true, authenticated: true }, 201);
  })
  .openapi(routes.login, async (c) => {
    const { username, password } = c.req.valid('json');
    // False on an unconfigured server too, and an unknown username still pays for a hash.
    if (!(await verifyCredentials(username, password))) return c.json(REFUSED, 401);

    setSessionCookie(c, createSession(db));
    return c.json({ configured: true, authenticated: true }, 200);
  })
  .openapi(routes.logout, (c) => {
    const token = readSessionCookie(c);
    if (token) deleteSession(db, token);
    // Cleared either way: a cookie naming a session that is already gone is still a cookie
    // the browser would keep sending.
    clearSessionCookie(c);
    return c.body(null, 204);
  });
