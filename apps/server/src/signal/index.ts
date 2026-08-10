import type { ServerType } from '@hono/node-server';
import {
  type ClientToServerEvents,
  clientToServer,
  type Payload,
  type Response,
  type ServerToClientEvents,
  type serverToClient,
} from '@linguacast/contract/socket';
import { Server, type Socket } from 'socket.io';
import { handle } from './handle';
import { handshakeGate } from './handshake';
import { validate } from './validate';

type C2S = ClientToServerEvents<typeof clientToServer>;
type S2C = ServerToClientEvents<typeof serverToClient>;

export type SignalServer = Server<C2S, S2C>;
type SignalSocket = Socket<C2S, S2C>;

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
  socket: SignalSocket,
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

/**
 * Attaches Socket.IO to the HTTP server @hono/node-server already created.
 *
 * Socket.IO's attach displaces that server's request listeners with its own, matching
 * its `path` and delegating everything else to what was there before. So /api/socket.io
 * is handled before Hono ever sees it and never reaches app.ts's /api/* 404 handler —
 * an interception that is invisible from app.ts, which is why there is a note there.
 *
 * The mount point is a PATH on the default namespace, not a namespace. Everything
 * dynamic then lives under /api and everything else is static, so Vite's existing proxy
 * rule extends to cover it and an operator's reverse proxy needs one rule rather than
 * two — which matters when the operator is a volunteer, not a platform team. Rooms
 * already give per-channel fan-out; namespaces stay available via io.of() if needed.
 */
export function attachSignal(httpServer: ServerType): SignalServer {
  const io: SignalServer = new Server(httpServer, {
    path: '/api/socket.io',
    // Engine.IO transport heartbeats — unrelated to the `ping` event below, which is an
    // application-level probe. Set explicitly rather than inherited so a Socket.IO
    // default change cannot quietly alter disconnect timing.
    pingInterval: 25_000,
    pingTimeout: 20_000,
    connectTimeout: 10_000,
  });

  // Connection-time gate: runs once per socket, before any packet.
  io.use(handshakeGate);

  io.on('connection', (socket) => {
    // Per-packet gate. Registered before any handler so it sees every inbound packet,
    // including ones no handler is registered for.
    socket.use(validate(clientToServer));

    on(socket, 'ping', () => ({ serverTime: Date.now() }));
  });

  return io;
}
