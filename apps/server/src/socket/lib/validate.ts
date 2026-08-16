import type { Ack, EventMap } from '@linguacast/contract/socket';
import type { Event } from 'socket.io';
import { z } from 'zod';

/**
 * Socket.IO puts the ack callback last when the client supplies one. Fire-and-forget
 * packets have none, and a failed packet then simply vanishes — which is correct.
 */
function replyError(args: unknown[], error: { code: string; message: string }): void {
  const ack = args.at(-1);
  if (typeof ack === 'function') (ack as (res: Ack<never>) => void)({ ok: false, error });
}

/**
 * Registered per-socket with socket.use(). This is the only file in the signalling
 * design that handles untyped values — it is the boundary where untrusted input becomes
 * typed, and everything downstream may assume the contract holds.
 *
 * Three things here are easy to "clean up" into bugs:
 *
 * 1. Failure calls the ack and skips next(). Calling next(err) instead would emit a
 *    client-side `error` event and never fire the ack, leaving the caller hanging until
 *    its ackTimeout. Not calling next() swallows the packet, which is the intent.
 * 2. socket.use runs for packets with NO registered listener. That is what turns an
 *    unknown or not-yet-implemented event into an immediate `unknown_event` ack rather
 *    than silence, and it is what makes the absence of compile-time handler
 *    exhaustiveness an acceptable trade (see CLAUDE.md).
 * 3. The substitution on the line `packet[1] = parsed.data` is the point of the whole
 *    middleware. Handlers receive Zod's output — coerced, defaulted, stripped — not the
 *    raw wire value. socket.io's Event is a mutable tuple precisely so this works.
 */
export function validate(contract: EventMap) {
  return (packet: Event, next: (err?: Error) => void): void => {
    const [name, ...args] = packet;
    const def = contract[name];

    if (!def) {
      replyError(args, { code: 'unknown_event', message: `Unknown event "${name}".` });
      return;
    }

    const parsed = def.payload.safeParse(args[0]);
    if (!parsed.success) {
      replyError(args, { code: 'invalid_payload', message: z.prettifyError(parsed.error) });
      return;
    }

    packet[1] = parsed.data;
    next();
  };
}
