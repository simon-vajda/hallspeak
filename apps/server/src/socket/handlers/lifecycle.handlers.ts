import type { SocketAuth } from '../../core/access';
import * as media from '../../core/media';
import type { Notification } from '../../core/notifications';
import { presence } from '../../core/presence';
import { eventRoom } from '../lib/rooms';

/** The subset of Server this module needs; a real Server satisfies it. */
export interface LifecycleServer {
  to(room: string): {
    emit(event: 'channel:status', payload: { slug: string; online: boolean }): unknown;
    emit(event: 'media:reset', payload: { reason: 'worker_died' | 'room_closed' }): unknown;
  };
  in(room: string): { disconnectSockets(close: boolean): unknown };
  sockets: { sockets: Map<string, { disconnect(close: boolean): unknown }> };
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
      io.to(eventRoom(notification.eventId)).emit('channel:status', {
        slug: notification.slug,
        online: notification.type === 'producer-opened',
      });
      return;

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
