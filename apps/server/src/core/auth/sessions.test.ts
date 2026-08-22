import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../db/client';
import { adminSessions } from '../../db/schema';
import { createTestDb } from '../../db/testing';
import {
  createSession,
  deleteAllSessions,
  deleteSession,
  lookupSession,
  RENEW_WHEN_REMAINING_MS,
  SESSION_TTL_MS,
  sweepExpired,
} from './sessions';

let db: Db;
let cleanup: () => void;

beforeEach(() => {
  ({ db, cleanup } = createTestDb());
});

afterEach(() => {
  cleanup();
});

function rows() {
  return db.select().from(adminSessions).all();
}

describe('createSession', () => {
  it('issues a token its own lookup finds', () => {
    const token = createSession(db);

    expect(lookupSession(db, token)).not.toBe('unknown');
  });

  it('stores the digest and never the token', () => {
    const token = createSession(db);

    expect(JSON.stringify(rows())).not.toContain(token);
  });

  it('mints a distinct token of the expected length each time', () => {
    const first = createSession(db);
    const second = createSession(db);

    expect(first).not.toBe(second);
    expect(Buffer.from(first, 'base64url')).toHaveLength(32);
    expect(Buffer.from(second, 'base64url')).toHaveLength(32);
  });
});

describe('lookupSession', () => {
  it('reports nothing for a token that was never issued', () => {
    expect(lookupSession(db, 'never-issued')).toBe('unknown');
  });

  it('reports nothing for an expired session and removes its row', () => {
    const token = createSession(db, Date.now() - SESSION_TTL_MS - 1);

    expect(lookupSession(db, token)).toBe('unknown');
    expect(rows()).toHaveLength(0);
  });

  it('reports a renewal and extends the expiry inside the threshold', () => {
    const issuedAt = Date.now() - SESSION_TTL_MS + RENEW_WHEN_REMAINING_MS / 2;
    const token = createSession(db, issuedAt);
    const before = rows()[0]?.expiresAt ?? 0;

    // The reported value is what tells the caller to re-send the cookie; without it the
    // row rolls forward where no browser can see it.
    expect(lookupSession(db, token)).toBe('renewed');

    expect(rows()[0]?.expiresAt ?? 0).toBeGreaterThan(before);
  });

  it('does not write for a session still outside the renewal threshold', () => {
    const token = createSession(db);
    const before = rows()[0]?.expiresAt ?? 0;

    expect(lookupSession(db, token)).toBe('valid');

    expect(rows()[0]?.expiresAt).toBe(before);
  });
});

describe('deleting sessions', () => {
  it('removes exactly the named session', () => {
    const mine = createSession(db);
    const theirs = createSession(db);

    deleteSession(db, mine);

    expect(lookupSession(db, mine)).toBe('unknown');
    expect(lookupSession(db, theirs)).toBe('valid');
  });

  it('is harmless for a token that was never issued', () => {
    const kept = createSession(db);

    deleteSession(db, 'never-issued');

    expect(lookupSession(db, kept)).toBe('valid');
  });

  it('empties the table on deleteAllSessions', () => {
    createSession(db);
    createSession(db);

    deleteAllSessions(db);

    expect(rows()).toHaveLength(0);
  });
});

describe('sweepExpired', () => {
  it('removes expired rows and keeps live ones', () => {
    const dead = createSession(db, Date.now() - SESSION_TTL_MS - 1);
    const live = createSession(db);

    sweepExpired(db);

    expect(rows()).toHaveLength(1);
    expect(lookupSession(db, live)).toBe('valid');
    expect(lookupSession(db, dead)).toBe('unknown');
  });
});
