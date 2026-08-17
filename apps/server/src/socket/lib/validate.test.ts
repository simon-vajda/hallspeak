import { event } from '@linguacast/contract/socket';
import type { Event } from 'socket.io';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { validate } from './validate';

// A local contract, not the real one: coupling these to the shipped event list would
// make every future event churn them.
const contract = {
  ping: event({ payload: z.object({}), response: z.object({ serverTime: z.int() }) }),
  join: event({ payload: z.object({ id: z.coerce.number() }) }),
};
const middleware = validate(contract);

describe('validate', () => {
  it('substitutes the parsed payload in place and calls next', () => {
    const ack = vi.fn();
    const next = vi.fn();
    const packet = ['join', { id: '42', extra: 'stripped' }, ack] as unknown as Event;

    middleware(packet, next);

    expect(next).toHaveBeenCalledOnce();
    // Coerced and stripped: the handler must see Zod's output, never the wire value.
    expect(packet[1]).toEqual({ id: 42 });
    expect(ack).not.toHaveBeenCalled();
  });

  it('acks invalid_payload and does NOT call next', () => {
    const ack = vi.fn();
    const next = vi.fn();

    middleware(['ping', 'not-an-object', ack] as unknown as Event, next);

    expect(next).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledWith({
      ok: false,
      error: { code: 'invalid_payload', message: expect.any(String) },
    });
  });

  it('acks unknown_event and does NOT call next', () => {
    const ack = vi.fn();
    const next = vi.fn();

    middleware(['nope', {}, ack] as unknown as Event, next);

    expect(next).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledWith({
      ok: false,
      error: { code: 'unknown_event', message: 'Unknown event "nope".' },
    });
  });

  it('does not throw when a failing packet carries no ack callback', () => {
    const next = vi.fn();

    expect(() => middleware(['nope', {}] as unknown as Event, next)).not.toThrow();
    expect(next).not.toHaveBeenCalled();
  });
});
