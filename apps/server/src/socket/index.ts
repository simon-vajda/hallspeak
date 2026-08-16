import type { ServerType } from '@hono/node-server';
import { clientToServer } from '@linguacast/contract/socket';
import { Server } from 'socket.io';
import { getChannelById } from '../core/channels.service';
import { presence } from '../core/presence';
import { db } from '../db';
import { joinChannel, leaveChannel } from './handlers/channels.handlers';
import { handshakeGate } from './handshake';
import { on } from './lib/on';
import { channelRoom, eventRoom } from './lib/rooms';
import type { SocketServer } from './lib/types';
import { validate } from './lib/validate';

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
export function attachSocket(httpServer: ServerType): SocketServer {
  const io: SocketServer = new Server(httpServer, {
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
  io: SocketServer,
  eventId: number,
  channelId: number,
  online: boolean,
): void {
  const channel = getChannelById(db, channelId);
  // The channel can be gone if the admin deleted it while a speaker was connected.
  if (!channel) return;
  io.to(eventRoom(eventId)).emit('channel:status', { slug: channel.slug, online });
}
