import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { envMock } = vi.hoisted(() => ({
  envMock: { NODE_ENV: 'test', LOG_LEVEL: 'trace', LOG_DIR: '' },
}));
vi.mock('../../env', () => ({ env: envMock }));

const { useLogDestination } = await import('../../lib/log');
const { AppError } = await import('../../lib/problem');
const { HANDLER_TIMEOUT_MS, handle } = await import('./handle');

let records: Record<string, unknown>[];

beforeEach(() => {
  records = [];
  useLogDestination({
    write(chunk: string) {
      records.push(JSON.parse(chunk));
    },
  });
});

describe('handle', () => {
  it('acks ok with the resolved value', async () => {
    const ack = vi.fn();

    await handle('ping', () => ({ serverTime: 7 }))({}, ack);

    expect(ack).toHaveBeenCalledWith({ ok: true, data: { serverTime: 7 } });
  });

  it('preserves an AppError code and message', async () => {
    const ack = vi.fn();

    await handle('ping', () => {
      throw new AppError('not_allowed', 'Nope.');
    })({}, ack);

    expect(ack).toHaveBeenCalledWith({
      ok: false,
      error: { code: 'not_allowed', message: 'Nope.' },
    });
  });

  it('maps any other throw to internal_error', async () => {
    const ack = vi.fn();

    await handle('ping', () => {
      throw new TypeError('boom');
    })({}, ack);

    expect(ack).toHaveBeenCalledWith({
      ok: false,
      error: { code: 'internal_error', message: 'An unexpected error occurred.' },
    });
  });

  it('does not throw when the event carries no ack callback', async () => {
    await expect(handle('noise', () => 1)({})).resolves.toBeUndefined();
  });

  describe('watchdog', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('acks timeout when the handler never settles', async () => {
      const ack = vi.fn();

      const settled = handle('ping', () => new Promise<number>(() => {}))({}, ack);
      await vi.advanceTimersByTimeAsync(HANDLER_TIMEOUT_MS);
      await settled;

      expect(ack).toHaveBeenCalledWith({
        ok: false,
        error: { code: 'timeout', message: 'Handler for "ping" timed out.' },
      });
      // The record must name the event as a field, or a hung handler is unfindable — and
      // it is written at error, so a wedged handler is visible at any level.
      expect(records).toContainEqual(
        expect.objectContaining({
          subsystem: 'socket',
          level: 50,
          msg: 'handler timed out',
          event: 'ping',
          timeoutMs: HANDLER_TIMEOUT_MS,
        }),
      );
    });

    it('does not fire the watchdog for a handler that settles in time', async () => {
      const ack = vi.fn();

      const settled = handle('ping', () => ({ serverTime: 1 }))({}, ack);
      await vi.advanceTimersByTimeAsync(HANDLER_TIMEOUT_MS * 2);
      await settled;

      expect(ack).toHaveBeenCalledExactlyOnceWith({ ok: true, data: { serverTime: 1 } });
    });
  });
});
