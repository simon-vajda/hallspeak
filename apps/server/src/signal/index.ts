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
import type { SocketAuth } from '../core/access';
import { getChannelById } from '../core/channels.service';
import { presence } from '../core/presence';
import { db } from '../db';
import { joinChannel, leaveChannel } from './channels';
import { handle } from './handle';
import { handshakeGate } from './handshake';
import { channelRoom, eventRoom } from './rooms';
import { validate } from './validate';

type C2S = ClientToServerEvents<typeof clientToServer>;
type S2C = ServerToClientEvents<typeof serverToClient>;
type ServerSideEvents = Record<string, never>;

// The fourth generic types socket.data, which the handshake gate fills in.
export type SignalServer = Server<C2S, S2C, ServerSideEvents, SocketAuth>;
type SignalSocket = Socket<C2S, S2C, ServerSideEvents, SocketAuth>;

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
    // application-level probe. Deliberately far below the defaults (25s/20s): a dead
    // speaker socket holds its channel until Socket.IO reaps it, and under the defaults
    // that is ~45 seconds during which a speaker whose phone slept is refused entry to
    // their own channel. ~5s bounds that window to about ten (spec E §7). The cost is
    // more keepalives on a connection that will soon carry audio anyway.
    pingInterval: 5_000,
    pingTimeout: 5_000,
    connectTimeout: 10_000,
  });

  // Connection-time gate: runs once per socket, before any packet.
  io.use(handshakeGate);

  io.on('connection', (socket) => {
    // Per-packet gate. Registered before any handler so it sees every inbound packet,
    // including ones no handler is registered for.
    socket.use(validate(clientToServer));

    // Re-established here rather than in the gate because Socket.IO replays the auth
    // payload on reconnect and nothing is sticky across connections.
    socket.join(eventRoom(socket.data.eventId));

    const speakerChannelId = socket.data.speakerChannelId;
    if (speakerChannelId !== null) {
      // The gate already claimed presence — synchronously, so no second speaker can
      // have slipped in between. This only publishes the fact.
      socket.join(channelRoom(speakerChannelId));
      broadcastChannelStatus(io, socket.data.eventId, speakerChannelId, true);
    }

    on(socket, 'ping', () => ({ serverTime: Date.now() }));
    on(socket, 'channel:join', ({ slug }) => joinChannel(db, presence, socket, socket.data, slug));
    on(socket, 'channel:leave', ({ slug }) => {
      leaveChannel(db, socket, socket.data, slug);
      // Explicit: a fire-and-forget event's Handler returns `undefined`, not `void`
      // (see the Response note in the contract's ./define), and the two differ here.
      return undefined;
    });

    socket.on('disconnect', () => {
      const released = presence.release(socket.id);
      if (released !== null) broadcastChannelStatus(io, socket.data.eventId, released, false);
    });
  });

  return io;
}

/** Liveness goes to the EVENT room so the selector and every channel page agree. */
function broadcastChannelStatus(
  io: SignalServer,
  eventId: number,
  channelId: number,
  online: boolean,
): void {
  const channel = getChannelById(db, channelId);
  // The channel can be gone if the admin deleted it while a speaker was connected.
  if (!channel) return;
  io.to(eventRoom(eventId)).emit('channel:status', { slug: channel.slug, online });
}
