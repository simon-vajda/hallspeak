import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTestApi } from '../../../testing/api';

// Passes through to the real derivation; the in-flight sign-in test holds one call open.
// password.ts imports nothing but node:crypto, so mocking it loads no env early.
vi.mock('../../../core/auth/password', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../core/auth/password')>();
  return { ...actual, verifyPassword: vi.fn(actual.verifyPassword) };
});

let api: Awaited<ReturnType<typeof createTestApi>>['api'];
let cleanup: () => void;
let resetAuth: () => void;

beforeAll(async () => {
  ({ api, cleanup, resetAuth } = await createTestApi());
});

afterEach(() => {
  resetAuth();
});

afterAll(() => {
  cleanup();
});

const from = (ip: string) => ({ incoming: { socket: { remoteAddress: ip } } });

// The sign-in limiter is a module singleton; each test takes addresses of its own.
let addresses = 0;
const freshIp = () => `10.210.0.${++addresses}`;

function post(path: string, body: unknown, ip = freshIp(), headers: Record<string, string> = {}) {
  return api.request(
    path,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    },
    from(ip),
  );
}

function jarOf(res: Response): Record<string, string> {
  return { cookie: (res.headers.get('set-cookie') ?? '').split(';')[0] ?? '' };
}

async function setup(ip = freshIp()) {
  return jarOf(await post('/auth/setup', { username: 'admin', password: 'hunter2!' }, ip));
}

async function signIn(password: string, ip = freshIp()) {
  return post('/auth/login', { username: 'admin', password }, ip);
}

function change(jar: Record<string, string>, body: unknown, ip = freshIp()) {
  return post('/admin/password', body, ip, jar);
}

function adminRequest(jar: Record<string, string>) {
  return api.request('/admin/events', { headers: jar }, from(freshIp()));
}

const valid = { currentPassword: 'hunter2!', newPassword: 'correct1!' };

describe('POST /admin/password', () => {
  it('changes the password, keeps the caller signed in and ends every other session', async () => {
    const laptop = await setup();
    const phone = jarOf(await signIn('hunter2!'));

    const res = await change(laptop, valid);

    expect(res.status).toBe(204);
    const rotated = jarOf(res);
    expect(rotated.cookie).toContain('__Host-hallspeak_session=');
    expect(rotated.cookie).not.toBe(laptop.cookie);
    expect((await adminRequest(rotated)).status).toBe(200);
    expect((await adminRequest(laptop)).status).toBe(401);
    expect((await adminRequest(phone)).status).toBe(401);
  });

  it('makes the new password the one that signs in', async () => {
    const jar = await setup();

    await change(jar, valid);

    expect((await signIn('correct1!')).status).toBe(200);
    expect((await signIn('hunter2!')).status).toBe(401);
  });

  it('refuses a wrong current password with 403 and changes nothing', async () => {
    const jar = await setup();

    const res = await change(jar, { currentPassword: 'hunter3!', newPassword: 'correct1!' });

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: 'invalid_credentials' });
    expect(res.headers.get('set-cookie')).toBeNull();
    expect((await adminRequest(jar)).status).toBe(200);
    expect((await signIn('hunter2!')).status).toBe(200);
  });

  it('accepts the current password as the new one and still ends other sessions', async () => {
    const laptop = await setup();
    const phone = jarOf(await signIn('hunter2!'));

    const res = await change(laptop, { currentPassword: 'hunter2!', newPassword: 'hunter2!' });

    expect(res.status).toBe(204);
    expect((await adminRequest(phone)).status).toBe(401);
    expect((await signIn('hunter2!')).status).toBe(200);
  });

  it('rejects a new password breaking a rule and changes nothing', async () => {
    const jar = await setup();

    const res = await change(jar, { currentPassword: 'hunter2!', newPassword: 'hunter22' });

    expect(res.status).toBe(400);
    expect((await signIn('hunter2!')).status).toBe(200);
  });

  it('answers 401 without a session, and charges nothing for it', async () => {
    await setup();
    const ip = freshIp();

    for (let i = 0; i < 15; i++) {
      expect((await change({}, valid, ip)).status).toBe(401);
    }
    expect((await signIn('wrong1!x', ip)).status).toBe(401);
  });

  it('throttles wrong current passwords with 429 and Retry-After, per address', async () => {
    const jar = await setup();
    const wrong = { currentPassword: 'wrong1!x', newPassword: 'correct1!' };

    let last = await change(jar, wrong, '10.211.0.1');
    for (let i = 0; i < 20 && last.status === 403; i++) {
      last = await change(jar, wrong, '10.211.0.1');
    }

    expect(last.status).toBe(429);
    expect(last.headers.get('Retry-After')).toBeTruthy();
    expect((await change(jar, wrong, '10.211.0.2')).status).toBe(403);
  });

  it('draws on the same budget as sign-in', async () => {
    const jar = await setup();
    const ip = '10.212.0.1';

    let last = await signIn('wrong1!x', ip);
    for (let i = 0; i < 20 && last.status === 401; i++) {
      last = await signIn('wrong1!x', ip);
    }
    expect(last.status).toBe(429);

    expect((await change(jar, valid, ip)).status).toBe(429);
  });

  it('does not charge a successful change', async () => {
    let jar = await setup();
    const ip = '10.213.0.1';
    let password = 'hunter2!';

    // One past the sign-in bucket's capacity of 10, so any charge would surface as a 429.
    for (let i = 0; i < 11; i++) {
      const next = `correct${i}!`;
      const res = await change(jar, { currentPassword: password, newPassword: next }, ip);
      expect(res.status).toBe(204);
      jar = jarOf(res);
      password = next;
    }
  });

  it('refuses a sign-in with the old password that was still hashing when the change landed', async () => {
    const jar = await setup();
    const { verifyPassword } = await import('../../../core/auth/password');
    const real = vi.mocked(verifyPassword).getMockImplementation();
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.mocked(verifyPassword).mockImplementationOnce(async (password, encoded) => {
      await held;
      return real ? real(password, encoded) : false;
    });

    const pending = signIn('hunter2!');
    expect((await change(jar, valid)).status).toBe(204);
    release();
    const res = await pending;

    expect(res.status).toBe(401);
    expect(res.headers.get('set-cookie')).toBeNull();
  });
});
