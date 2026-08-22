import { createHash, randomBytes } from 'node:crypto';
import { eq, lte } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { adminSessions } from '../../db/schema';

/** Long enough that a NAS rebooting for a firmware update never costs a re-sign-in. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * The expiry is only rewritten once this little is left, so a rolling 30 days costs one
 * write a day rather than one per request.
 */
export const RENEW_WHEN_REMAINING_MS = 24 * 60 * 60 * 1000;

const TOKEN_BYTES = 32;

/**
 * 256 bits of entropy, so a fast digest is enough — the token is not guessable and a slow
 * KDF on every request would buy nothing. Only the digest is ever stored.
 */
function digest(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Returns the raw token to its caller and keeps none of it: nothing else ever sees it. */
export function createSession(db: Db, now: number = Date.now()): string {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  db.insert(adminSessions)
    .values({ tokenHash: digest(token), createdAt: now, expiresAt: now + SESSION_TTL_MS })
    .run();
  return token;
}

export type SessionLookup = 'unknown' | 'valid' | 'renewed';

/**
 * Expired rows are deleted where they are found, which is why no sweep is scheduled.
 * `renewed` is reported rather than swallowed: the row's new expiry is invisible to the
 * browser until the caller re-sends the cookie with a matching Max-Age.
 */
export function lookupSession(db: Db, token: string, now: number = Date.now()): SessionLookup {
  const tokenHash = digest(token);
  const row = db.select().from(adminSessions).where(eq(adminSessions.tokenHash, tokenHash)).get();
  if (!row) {
    return 'unknown';
  }

  if (row.expiresAt <= now) {
    db.delete(adminSessions).where(eq(adminSessions.tokenHash, tokenHash)).run();
    return 'unknown';
  }

  if (row.expiresAt - now < RENEW_WHEN_REMAINING_MS) {
    db.update(adminSessions)
      .set({ expiresAt: now + SESSION_TTL_MS })
      .where(eq(adminSessions.tokenHash, tokenHash))
      .run();
    return 'renewed';
  }

  return 'valid';
}

export function deleteSession(db: Db, token: string): void {
  db.delete(adminSessions)
    .where(eq(adminSessions.tokenHash, digest(token)))
    .run();
}

/** The recovery half: completing setup must strand every session issued before it. */
export function deleteAllSessions(db: Db): void {
  db.delete(adminSessions).run();
}

export function sweepExpired(db: Db, now: number = Date.now()): void {
  db.delete(adminSessions).where(lte(adminSessions.expiresAt, now)).run();
}
