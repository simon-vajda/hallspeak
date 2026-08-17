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
 * Attach displaces the HTTP server's request listeners, so /api/socket.io is handled
 * before Hono sees it and never reaches app.ts's /api/* 404.
 * A path on the default namespace, not a namespace: all dynamic traffic then sits under
 * /api, so one Vite proxy rule and one reverse-proxy rule cover both.
 */
export function attachSocket(httpServer: ServerType): SocketServer {
  const io: SocketServer = new Server(httpServer, {
    path: '/api/socket.io',
    // Engine.IO heartbeats, unrelated to the `ping` event below. Far below the 25s/20s
    // defaults because a dead speaker socket holds its channel until Socket.IO reaps it:
    // ~5s bounds that window to about ten seconds instead of ~45.
    pingInterval: 5_000,
    pingTimeout: 5_000,
    connectTimeout: 10_000,
  });

  io.use(handshakeGate);

  io.on('connection', (socket) => {
    // Before any handler, so it also sees packets no handler is registered for.
    socket.use(validate(clientToServer));

    // Re-established here rather than in the gate: nothing is sticky across connections
    // and Socket.IO replays the auth payload on reconnect.
    socket.join(eventRoom(socket.data.eventId));

    const speakerChannelId = socket.data.speakerChannelId;
    if (speakerChannelId !== null) {
      // The gate already claimed presence, synchronously; this only publishes it.
      socket.join(channelRoom(speakerChannelId));
      broadcastChannelStatus(io, socket.data.eventId, speakerChannelId, true);
    }

    on(socket, 'ping', () => ({ serverTime: Date.now() }));
    on(socket, 'channel:join', ({ slug }) => joinChannel(db, presence, socket, socket.data, slug));
    on(socket, 'channel:leave', ({ slug }) => {
      leaveChannel(db, socket, socket.data, slug);
      // A fire-and-forget Handler returns `undefined`, not `void`.
      return undefined;
    });

    socket.on('disconnect', () => {
      const released = presence.release(socket.id);
      if (released !== null) broadcastChannelStatus(io, socket.data.eventId, released, false);
    });
  });

  return io;
}

/** To the event room, not the channel room, so the selector and every channel page agree. */
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
