import type { clientToServer, Payload, Response } from '@hallspeak/contract/socket';
import { handle } from './handle';
import type { ConnectedSocket } from './types';

type Handler<K extends keyof typeof clientToServer> = (
  payload: Payload<(typeof clientToServer)[K]>,
) => Promise<Response<(typeof clientToServer)[K]>> | Response<(typeof clientToServer)[K]>;

/**
 * Registers a contract event, naming it once and passing the name through to `handle`'s
 * watchdog log. Not a handler registry: a plain call keeps handlers with their feature
 * and `socket` in scope for rooms and disconnect.
 */
export function on<K extends keyof typeof clientToServer & string>(
  socket: ConnectedSocket,
  event: K,
  fn: Handler<K>,
): void {
  // socket.on types its listener as a conditional over the event name, which TypeScript
  // cannot reduce while K is generic. The signature above is where the guarantee lives.
  (socket.on as (event: K, listener: (...args: never[]) => void) => void)(
    event,
    handle(event, fn) as (...args: never[]) => void,
  );
}
