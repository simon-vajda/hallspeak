import * as routes from '@hallspeak/contract/routes';
import { OpenAPIHono } from '@hono/zod-openapi';
import { changePassword, createSession, deleteAllSessions } from '../../../core/auth';
import { db } from '../../../db';
import { defaultHook } from '../../default-hook';
import { setSessionCookie } from '../../session-cookie';

export const adminAccountRoutes = new OpenAPIHono({ defaultHook }).openapi(
  routes.adminChangePassword,
  async (c) => {
    const { currentPassword, newPassword } = c.req.valid('json');
    const outcome = await changePassword(currentPassword, newPassword);

    if (outcome === 'refused') {
      return c.json(
        { code: 'invalid_credentials', message: 'The current password is incorrect.' },
        403,
      );
    }
    if (outcome === 'in_progress') {
      return c.json(
        {
          code: 'password_change_in_progress',
          message: 'A password change is already in progress. Try again.',
        },
        409,
      );
    }

    // Every session, the caller's included, then a fresh one for the caller: a token that
    // may have leaked alongside the old password does not survive the change.
    deleteAllSessions(db);
    setSessionCookie(c, createSession(db));
    return c.body(null, 204);
  },
);
