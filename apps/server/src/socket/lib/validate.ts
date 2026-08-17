import type { Ack, EventMap } from '@linguacast/contract/socket';
import type { Event } from 'socket.io';
import { z } from 'zod';

/**
 * Socket.IO puts the ack callback last when the client supplies one. Fire-and-forget
 * packets have none, so a failed packet vanishes, which is correct.
 */
function replyError(args: unknown[], error: { code: string; message: string }): void {
  const ack = args.at(-1);
  if (typeof ack === 'function') (ack as (res: Ack<never>) => void)({ ok: false, error });
}

/**
 * The boundary where untrusted input becomes typed; everything downstream may assume the
 * contract holds. Three things here are easy to "clean up" into bugs:
 *
 * 1. Failure calls the ack and skips next(). next(err) would emit a client-side `error`
 *    event and never fire the ack; not calling next() swallows the packet, as intended.
 * 2. socket.use runs for packets with no registered listener, which is what turns an
 *    unimplemented event into an immediate `unknown_event` ack rather than silence.
 * 3. `packet[1] = parsed.data` is the point of the middleware: handlers receive Zod's
 *    output, not the raw wire value. socket.io's Event is a mutable tuple so this works.
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
