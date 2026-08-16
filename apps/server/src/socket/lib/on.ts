import type { clientToServer, Payload, Response } from '@linguacast/contract/socket';
import { handle } from './handle';
import type { ConnectedSocket } from './types';

/** One event's handler, as the contract defines it. Both sides are inferred at use. */
type Handler<K extends keyof typeof clientToServer> = (
  payload: Payload<(typeof clientToServer)[K]>,
) => Promise<Response<(typeof clientToServer)[K]>> | Response<(typeof clientToServer)[K]>;

/**
 * Registers a contract event, naming it exactly once:
 *
 *   on(socket, 'ping', () => ({ serverTime: Date.now() }));
 *
 * `handle` still takes the name separately because it needs it for the watchdog log —
 * a listener cannot recover its own event name from socket.on. That is an argument for
 * `handle`, not a second literal for the caller, so this passes it through.
 *
 * Deliberately NOT a handler registry (events mapped to handlers as data): this is a
 * plain call, so handlers still live wherever their feature does, `socket` is still in
 * scope for rooms and disconnect, and nothing has to be collected up front.
 */
export function on<K extends keyof typeof clientToServer & string>(
  socket: ConnectedSocket,
  event: K,
  fn: Handler<K>,
): void {
  // The cast is confined to this line and is not a hole in the contract. socket.on types
  // its listener as a conditional over the event name, which TypeScript cannot reduce
  // while K is still generic — it can only check the call once K is a literal, which is
  // exactly what it is at every call site but not here. The signature above is where the
  // guarantee lives: K must be a contract key, and Handler<K> pins the payload and the
  // return type to that key's schemas. define.test-d.ts asserts that pinning holds.
  (socket.on as (event: K, listener: (...args: never[]) => void) => void)(
    event,
    handle(event, fn) as (...args: never[]) => void,
  );
}
