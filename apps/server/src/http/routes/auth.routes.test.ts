import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestApi } from '../../testing/api';

let api: Awaited<ReturnType<typeof createTestApi>>['api'];
let cleanup: () => void;
let resetAuth: () => void;

beforeAll(async () => {
  ({ api, cleanup, resetAuth } = await createTestApi());
});

afterEach(() => {
  // Every test starts from a fresh install; the ones that need an account make one.
  resetAuth();
});

afterAll(() => {
  cleanup();
});

const from = (ip: string) => ({ incoming: { socket: { remoteAddress: ip } } });

// The sign-in limiter is a module singleton, so a test that does not care about
// throttling gets an address of its own rather than inheriting another test's budget.
let addresses = 0;
const freshIp = () => `10.200.0.${++addresses}`;

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

function cookieOf(res: Response): string {
  return res.headers.get('set-cookie') ?? '';
}

/** The value a browser would send back, as the request header. */
function jarOf(res: Response): Record<string, string> {
  const pair = cookieOf(res).split(';')[0] ?? '';
  return { cookie: pair };
}

async function setup(username = 'admin', password = 'hunter2!', ip = freshIp()) {
  return post('/auth/setup', { username, password }, ip);
}

describe('GET /auth/session', () => {
  it('reports a fresh server as unconfigured and unauthenticated', async () => {
    const res = await api.request('/auth/session', undefined, from('10.0.0.1'));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ configured: false, authenticated: false });
  });

  it('reports both true once setup has run', async () => {
    const created = await setup();

    const res = await api.request('/auth/session', { headers: jarOf(created) }, from('10.0.0.1'));

    expect(await res.json()).toEqual({ configured: true, authenticated: true });
  });

  it('is never throttled, however hard it is called', async () => {
    for (let i = 0; i < 40; i++) {
      const res = await api.request('/auth/session', undefined, from('10.9.9.9'));
      expect(res.status).toBe(200);
    }
  });
});

describe('POST /auth/setup', () => {
  it('creates the account and signs the caller in', async () => {
    const res = await setup();

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ configured: true, authenticated: true });
    expect(cookieOf(res)).toContain('__Host-linguacast_session=');
  });

  it('issues an httpOnly, Secure, Lax cookie on the whole site', async () => {
    const cookie = cookieOf(await setup());

    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
    expect(cookie).not.toContain('Domain=');
  });

  it('refuses a second account and leaves the first one signing in', async () => {
    await setup('admin', 'hunter2!');

    const second = await setup('intruder', 'letmein1!');

    expect(second.status).toBe(409);
    expect((await post('/auth/login', { username: 'admin', password: 'hunter2!' })).status).toBe(
      200,
    );
    expect(
      (await post('/auth/login', { username: 'intruder', password: 'letmein1!' })).status,
    ).toBe(401);
  });

  it('rejects a password that breaks a rule', async () => {
    const res = await setup('admin', 'hunter22');

    expect(res.status).toBe(400);
    const state = await api.request('/auth/session', undefined, from('10.0.0.1'));
    expect(await state.json()).toEqual({ configured: false, authenticated: false });
  });

  it('strands every session that existed before it', async () => {
    const before = await setup('admin', 'hunter2!');
    resetAuth();

    await setup('admin', 'hunter3!');

    const res = await api.request('/auth/session', { headers: jarOf(before) }, from('10.0.0.1'));
    expect(await res.json()).toEqual({ configured: true, authenticated: false });
  });
});

describe('POST /auth/login', () => {
  it('signs in with the right credentials', async () => {
    await setup();

    const res = await post('/auth/login', { username: 'admin', password: 'hunter2!' });

    expect(res.status).toBe(200);
    expect(cookieOf(res)).toContain('__Host-linguacast_session=');
  });

  it('answers a wrong password and an unknown username identically', async () => {
    await setup();

    const wrongPassword = await post('/auth/login', { username: 'admin', password: 'wrong1!x' });
    const unknownUser = await post('/auth/login', { username: 'nobody', password: 'wrong1!x' });

    const wrongBody = await wrongPassword.json();
    const unknownBody = await unknownUser.json();
    expect(wrongPassword.status).toBe(unknownUser.status);
    expect(wrongBody).toEqual(unknownBody);
    // Anchored absolutely too, so the pair regressing together still fails.
    expect(unknownUser.status).toBe(401);
    expect(unknownBody).toEqual({
      code: 'invalid_credentials',
      message: 'Those credentials do not match.',
    });
  });

  it('refuses on an unconfigured server', async () => {
    const res = await post('/auth/login', { username: 'admin', password: 'hunter2!' });

    expect(res.status).toBe(401);
  });

  it('does not apply the password rules to what is typed', async () => {
    await setup();

    const res = await post('/auth/login', { username: 'admin', password: 'short' });

    expect(res.status).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  it('ends the session and clears the cookie', async () => {
    const created = await setup();

    const res = await post('/auth/logout', {}, '10.0.0.1', jarOf(created));

    expect(res.status).toBe(204);
    expect(cookieOf(res)).toContain('Max-Age=0');
    const after = await api.request('/auth/session', { headers: jarOf(created) }, from('10.0.0.1'));
    expect(await after.json()).toEqual({ configured: true, authenticated: false });
  });

  it('succeeds without a cookie', async () => {
    await setup();

    expect((await post('/auth/logout', {})).status).toBe(204);
  });
});

describe('sign-in throttling', () => {
  const wrong = { username: 'admin', password: 'wrong1!x' };

  it('refuses a flood with 429 and Retry-After, leaving other addresses alone', async () => {
    await setup();

    let last = await post('/auth/login', wrong, '10.1.1.1');
    for (let i = 0; i < 20 && last.status === 401; i++) {
      last = await post('/auth/login', wrong, '10.1.1.1');
    }

    expect(last.status).toBe(429);
    expect(last.headers.get('Retry-After')).toBeTruthy();
    expect((await post('/auth/login', wrong, '10.1.1.2')).status).toBe(401);
  });

  it('still admits the correct password from an address that has not been throttled', async () => {
    await setup();

    let last = await post('/auth/login', wrong, '10.2.2.1');
    for (let i = 0; i < 20 && last.status === 401; i++) {
      last = await post('/auth/login', wrong, '10.2.2.1');
    }
    expect(last.status).toBe(429);

    const elsewhere = await post(
      '/auth/login',
      { username: 'admin', password: 'hunter2!' },
      '10.2.2.2',
    );

    expect(elsewhere.status).toBe(200);
  });

  it('does not charge a successful sign-in', async () => {
    await setup();

    for (let i = 0; i < 15; i++) {
      const res = await post(
        '/auth/login',
        { username: 'admin', password: 'hunter2!' },
        '10.3.3.1',
      );
      expect(res.status).toBe(200);
    }
  });

  it('charges a refused setup, so repeating it costs the same budget', async () => {
    await setup('admin', 'hunter2!', '10.4.4.1');

    let last = await setup('again', 'hunter3!', '10.4.4.1');
    for (let i = 0; i < 20 && last.status === 409; i++) {
      last = await setup('again', 'hunter3!', '10.4.4.1');
    }

    expect(last.status).toBe(429);
  });
});
