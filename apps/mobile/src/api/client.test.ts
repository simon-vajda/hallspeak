import { shouldRetryApiQuery } from '@hallspeak/client-core/query-retry';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createApiClient, REQUEST_TIMEOUT_MS } from './client';

const never: typeof fetch = () => new Promise<Response>(() => {});

const answer = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const readEvent = (fetchImpl: typeof fetch, signal?: AbortSignal) =>
  createApiClient('a.example', fetchImpl).GET('/events/{pin}', {
    params: { path: { pin: '834912' } },
    ...(signal ? { signal } : {}),
  });

describe('request timeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('settles a request nobody answers as unreachable once the deadline passes', async () => {
    let settled = false;
    const pending = readEvent(never).then((result) => {
      settled = true;
      return result;
    });

    await jest.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1);
    expect(settled).toBe(false);

    await jest.advanceTimersByTimeAsync(1);
    const { data, error, response } = await pending;

    expect(data).toBeUndefined();
    expect(response.status).toBe(503);
    expect(error).toEqual({ code: 'unavailable', message: 'The server could not be reached.' });
  });

  it('resolves an answer that arrives before the deadline and leaves no timer behind', async () => {
    const body = { name: 'Sunday service' };
    const { data } = await readEvent(async () => answer(body));

    expect(data).toEqual(body);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('aborts the underlying request when the deadline passes', async () => {
    let seen: AbortSignal | undefined;
    const pending = readEvent((input) => {
      seen = (input as Request).signal;
      return never(input);
    });

    await jest.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    await pending;

    expect(seen?.aborted).toBe(true);
  });

  it("rejects as a cancellation, not a 503, when the caller's signal aborts first", async () => {
    const controller = new AbortController();
    const pending = readEvent(never, controller.signal);

    await jest.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS / 2);
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(jest.getTimerCount()).toBe(0);
  });

  it('passes the caller signal through to an aborted underlying request', async () => {
    const controller = new AbortController();
    let seen: AbortSignal | undefined;
    const pending = readEvent((input) => {
      seen = (input as Request).signal;
      return never(input);
    }, controller.signal);

    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(seen?.aborted).toBe(true);
  });

  it('classifies a timed-out attempt as one to retry', async () => {
    const pending = readEvent(never);

    await jest.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    const { error } = await pending;

    expect(shouldRetryApiQuery(0, error)).toBe(true);
  });
});
