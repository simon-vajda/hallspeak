import { describe, expect, it } from 'vitest';
import { SocketError, unwrap } from './unwrap';

describe('unwrap', () => {
  it('returns the data of a successful ack', () => {
    expect(unwrap({ ok: true, data: { serverTime: 5 } })).toEqual({ serverTime: 5 });
  });

  it('throws SocketError carrying the code and message', () => {
    expect(() => unwrap({ ok: false, error: { code: 'timeout', message: 'Too slow.' } })).toThrow(
      SocketError,
    );

    try {
      unwrap({ ok: false, error: { code: 'timeout', message: 'Too slow.' } });
      expect.unreachable('unwrap should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(SocketError);
      expect((err as SocketError).code).toBe('timeout');
      expect((err as SocketError).message).toBe('Too slow.');
      expect((err as SocketError).name).toBe('SocketError');
    }
  });
});
