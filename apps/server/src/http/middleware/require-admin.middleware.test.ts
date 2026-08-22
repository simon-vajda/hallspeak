import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createChannel } from '../../core/channels.service';
import { createEvent } from '../../core/events.service';
import type { Db } from '../../db/client';
import { adminSessions } from '../../db/schema';
import { type ApiRequest, createTestApi } from '../../testing/api';

let api: Awaited<ReturnType<typeof createTestApi>>['api'];
let db: Db;
let cleanup: () => void;
let request: ApiRequest;
let createSession: (now?: number) => string;
let resetAuth: () => void;
let SESSION_TTL_MS: number;
let pin: string;

const cookie = (token: string) => ({ cookie: `__Host-linguacast_session=${token}` });

beforeAll(async () => {
  const created = await createTestApi();
  ({ api, db, cleanup, createSession, resetAuth, SESSION_TTL_MS } = created);
  request = await created.signInAsAdmin();

  const event = createEvent(db, { name: 'Sunday Service', enabled: true });
  createChannel(db, event.id, { slug: 'english', name: 'English', enabled: true });
  pin = event.pin;
});

afterAll(() => {
  cleanup();
});

const ADMIN_ROUTES = [
  ['events', '/admin/events'],
  ['channels', '/admin/events/1/channels'],
  ['live', '/admin/live'],
] as const;

describe('without a session', () => {
  it.each(ADMIN_ROUTES)('refuses the %s routes with a Problem', async (_family, path) => {
    const res = await api.request(path);

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ code: 'unauthenticated', message: 'Sign in first.' });
  });

  it('refuses a cookie value that was never a token', async () => {
    const res = await api.request('/admin/events', { headers: cookie('not-a-token') });

    expect(res.status).toBe(401);
  });

  it('refuses an expired session and leaves no row behind', async () => {
    const before = db.select().from(adminSessions).all().length;
    const stale = createSession(Date.now() - 400 * 24 * 60 * 60 * 1000);

    const res = await api.request('/admin/events', { headers: cookie(stale) });

    expect(res.status).toBe(401);
    expect(db.select().from(adminSessions).all()).toHaveLength(before);
  });
});

describe('with a session', () => {
  it('reaches the handler and returns the normal body', async () => {
    const res = await request('/admin/events');

    expect(res.status).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  it('sends no cookie for a session nowhere near its expiry', async () => {
    const res = await request('/admin/events');

    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('re-sends the cookie when the row is renewed, so Max-Age follows it', async () => {
    // Inside the renewal window: the row rolls forward, and without the Set-Cookie the
    // browser would still drop the cookie 30 days after sign-in.
    const ageing = createSession(Date.now() - SESSION_TTL_MS + 60_000);

    const res = await api.request('/admin/events', { headers: cookie(ageing) });

    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toContain('__Host-linguacast_session=');
    expect(res.headers.get('set-cookie')).toContain('Max-Age=');
  });
});

describe('everything outside the prefix', () => {
  it('leaves the public event routes and the version route alone', async () => {
    expect((await api.request('/version')).status).toBe(200);
    expect((await api.request(`/events/${pin}`)).status).toBe(200);
    expect((await api.request('/auth/session')).status).toBe(200);
  });
});

// Last, because the recovery it performs deletes the credential file for good.
describe('on an unconfigured server', () => {
  it('refuses even a session row issued before the recovery', async () => {
    const token = createSession();
    resetAuth();

    const res = await api.request('/admin/events', { headers: cookie(token) });

    expect(res.status).toBe(401);
  });

  it('still serves the guest a printed listener link', async () => {
    expect((await api.request(`/events/${pin}`)).status).toBe(200);
    expect((await api.request('/version')).status).toBe(200);
  });
});
