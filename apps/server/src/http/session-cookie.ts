import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { SESSION_TTL_MS } from '../core/auth';

/**
 * The `__Host-` prefix is browser-enforced as Secure, Path=/ and no Domain. HTTPS is
 * already required by getUserMedia, so nothing is lost. Hono applies those three itself
 * when given the prefix — but it has to be supplied at all three call sites below, or the
 * name will not match.
 */
const NAME = 'linguacast_session';

export function readSessionCookie(c: Context): string | undefined {
  return getCookie(c, NAME, 'host');
}

export function setSessionCookie(c: Context, token: string): void {
  setCookie(c, NAME, token, {
    prefix: 'host',
    httpOnly: true,
    // Lax plus non-GET mutations is the whole CSRF position: the admin SPA is same-origin
    // with its API and every admin write is a non-GET request.
    sameSite: 'Lax',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, NAME, { prefix: 'host', httpOnly: true, sameSite: 'Lax' });
}
