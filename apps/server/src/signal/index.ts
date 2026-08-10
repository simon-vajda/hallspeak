import type { ServerType } from '@hono/node-server';
import {
  type ClientToServerEvents,
  clientToServer,
  type ServerToClientEvents,
  type serverToClient,
} from '@linguacast/contract/socket';
import { Server } from 'socket.io';
import { handle } from './handle';
import { handshakeGate } from './handshake';
import { validate } from './validate';

export type SignalServer = Server<
  ClientToServerEvents<typeof clientToServer>,
  ServerToClientEvents<typeof serverToClient>
>;

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

    socket.on(
      'ping',
      handle('ping', () => ({ serverTime: Date.now() })),
    );
  });

  return io;
}
