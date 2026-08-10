import { describe, expect, it } from 'vitest';
import { SignalError, unwrap } from './unwrap';

describe('unwrap', () => {
  it('returns the data of a successful ack', () => {
    expect(unwrap({ ok: true, data: { serverTime: 5 } })).toEqual({ serverTime: 5 });
  });

  it('throws SignalError carrying the code and message', () => {
    expect(() => unwrap({ ok: false, error: { code: 'timeout', message: 'Too slow.' } })).toThrow(
      SignalError,
    );

    try {
      unwrap({ ok: false, error: { code: 'timeout', message: 'Too slow.' } });
      expect.unreachable('unwrap should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(SignalError);
      expect((err as SignalError).code).toBe('timeout');
      expect((err as SignalError).message).toBe('Too slow.');
      expect((err as SignalError).name).toBe('SignalError');
    }
  });
});
