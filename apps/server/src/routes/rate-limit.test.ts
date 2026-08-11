import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { TokenBucketLimiter } from '../lib/rate-limit';
import { createRateLimit } from './rate-limit';

function build(capacity: number, now: () => number) {
  const app = new Hono();
  app.use(
    '*',
    createRateLimit({
      perIp: new TokenBucketLimiter({ capacity, refillPerSecond: 1, now }),
      shared: new TokenBucketLimiter({ capacity: 1_000, refillPerSecond: 100, now }),
    }),
  );
  app.get('/hit', (c) => c.json({ ok: true }));
  app.get('/miss', (c) => c.json({ code: 'not_found', message: 'Not found.' }, 404));
  return app;
}

// @hono/node-server puts the IncomingMessage on c.env.incoming; app.request's third
// argument is that env, so the same extraction path is exercised here as in production.
const from = (ip: string) => ({ incoming: { socket: { remoteAddress: ip } } });

describe('createRateLimit', () => {
  it('never charges a successful lookup', async () => {
    const now = 0;
    const app = build(2, () => now);

    for (let i = 0; i < 10; i++) {
      expect((await app.request('/hit', undefined, from('1.1.1.1'))).status).toBe(200);
    }
  });

  it('admits the burst, then answers 429 with Retry-After', async () => {
    const now = 0;
    const app = build(2, () => now);

    expect((await app.request('/miss', undefined, from('2.2.2.2'))).status).toBe(404);
    expect((await app.request('/miss', undefined, from('2.2.2.2'))).status).toBe(404);

    const throttled = await app.request('/miss', undefined, from('2.2.2.2'));

    expect(throttled.status).toBe(429);
    expect(throttled.headers.get('Retry-After')).toBe('1');
  });

  it('refills over time', async () => {
    let now = 0;
    const app = build(1, () => now);
    await app.request('/miss', undefined, from('3.3.3.3'));

    expect((await app.request('/miss', undefined, from('3.3.3.3'))).status).toBe(429);

    now += 1_000;

    expect((await app.request('/miss', undefined, from('3.3.3.3'))).status).toBe(404);
  });

  it('throttles one address without touching another', async () => {
    const now = 0;
    const app = build(1, () => now);
    await app.request('/miss', undefined, from('4.4.4.4'));

    expect((await app.request('/miss', undefined, from('4.4.4.4'))).status).toBe(429);
    expect((await app.request('/miss', undefined, from('5.5.5.5'))).status).toBe(404);
  });
});
