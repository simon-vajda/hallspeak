import type { SocketAuth } from '../../core/access';
import { getChannelById } from '../../core/channels.service';
import * as media from '../../core/media';
import type { Notification } from '../../core/notifications';
import { presence } from '../../core/presence';
import type { Db } from '../../db/client';
import { eventRoom } from '../lib/rooms';

/** The subset of Server this module needs; a real Server satisfies it. */
export interface LifecycleServer {
  to(room: string): {
    emit(
      event: 'channel:status',
      payload: { slug: string; online: boolean; muted: boolean },
    ): unknown;
    emit(event: 'media:reset', payload: { reason: 'worker_died' }): unknown;
    emit(event: 'channel:listeners', payload: { slug: string; count: number }): unknown;
  };
  in(room: string): { disconnectSockets(close: boolean): unknown };
  sockets: { sockets: Map<string, { disconnect(close: boolean): unknown }> };
}

/** The subset of Socket the connect-time count needs; a real Socket satisfies it. */
export interface LifecycleSocket {
  emit(event: 'channel:listeners', payload: { slug: string; count: number }): unknown;
}

/**
 * A disconnect closes this socket's media and then gives up its claim, in that order:
 * closing the peer is what publishes the producer going away, and the claim outliving it
 * by a tick is harmless while the reverse would broadcast liveness for a producer that is
 * already gone.
 */
export function releaseSocket(socket: { id: string }, auth: SocketAuth): void {
  media.releasePeer(auth.eventId, socket.id);
  presence.release(socket.id);
}

/**
 * The only place in the codebase that turns a published fact into a socket action.
 *
 * The reason decides which action, because the two are not interchangeable. Access
 * revoked means the session may no longer be here at all, so it is disconnected. A dead
 * worker took the media and nothing else — the PIN is still valid and the claim still
 * held — so those clients are told to discard their identifiers and renegotiate, which
 * is the same path a server restart puts them on.
 */
export function applyNotification(io: LifecycleServer, notification: Notification): void {
  switch (notification.type) {
    case 'producer-opened':
    case 'producer-closed':
    case 'producer-paused':
    case 'producer-resumed':
      io.to(eventRoom(notification.eventId)).emit('channel:status', {
        slug: notification.slug,
        ...media.channelStatus(notification.eventId, notification.channelId),
      });
      return;

    /**
     * Addressed to the claim holder, never to `channelRoom(channelId)`: every listening
     * guest is in that room, so a room-scoped emit would hand all n of them a number that
     * is the speaker's alone. `io.to(socketId)` reaches one socket because Socket.IO puts
     * every socket in a room named after its own id. A channel nobody is speaking on has
     * nobody to tell.
     */
    case 'listeners-changed': {
      const holder = presence.holder(notification.channelId);
      if (holder === undefined) return;
      io.to(holder).emit('channel:listeners', {
        slug: notification.slug,
        count: notification.count,
      });
      return;
    }

    case 'peer-evicted': {
      // Already gone is the common case on a takeover; there is nothing to do about it.
      io.sockets.sockets.get(notification.socketId)?.disconnect(true);
      return;
    }

    case 'room-evicted': {
      const room = eventRoom(notification.eventId);
      if (notification.reason === 'worker_died') {
        io.to(room).emit('media:reset', { reason: 'worker_died' });
        return;
      }
      // Resolved against Socket.IO's own room membership, which is the only way to reach
      // a listener who armed nothing and is therefore invisible to core/.
      io.in(room).disconnectSockets(true);
      return;
    }
  }
}

/**
 * A studio connecting to a channel that is already being listened to must not sit blank
 * until the next change, so it is told the current count on connect. Zero is a number the
 * studio can render; sending nothing is not.
 *
 * It lives here rather than in `socket/index.ts` because that module is only reachable
 * through `attachSocket(httpServer)` and could not be tested without binding a real server.
 */
export function sendInitialListenerCount(db: Db, socket: LifecycleSocket, auth: SocketAuth): void {
  const channelId = auth.speakerChannelId;
  if (channelId === null) return;

  // `socket.data` carries no slug, so the wire's identifier is read back off the row.
  const channel = getChannelById(db, channelId);
  if (!channel) return;

  socket.emit('channel:listeners', {
    slug: channel.slug,
    count: media.listenerCount(auth.eventId, channelId),
  });
}
