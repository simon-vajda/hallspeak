import type { SocketAuth } from '../../core/access';
import { findEnabledChannelBySlug } from '../../core/channels.service';
import type { PresenceRegistry } from '../../core/presence';
import type { Db } from '../../db/client';
import { AppError } from '../../lib/problem';
import { channelRoom } from '../lib/rooms';

/** The subset of Socket this module needs. A real Socket satisfies it. */
export interface RoomSocket {
  join(room: string): void;
  leave(room: string): void;
}

/**
 * Resolving the slug against the socket's OWN event is what stops a socket
 * authenticated for event A from joining a channel of event B: a foreign slug does not
 * resolve, so there is no separate ownership check to forget.
 */
export function joinChannel(
  db: Db,
  presence: PresenceRegistry,
  socket: RoomSocket,
  auth: SocketAuth,
  slug: string,
): { online: boolean } {
  const channel = findEnabledChannelBySlug(db, auth.eventId, slug);
  if (!channel) throw new AppError('not_found', `No channel "${slug}" on this event.`);

  socket.join(channelRoom(channel.id));
  return { online: presence.isOnline(channel.id) };
}

/** Fire-and-forget: a leave that resolves to nothing has already achieved its goal. */
export function leaveChannel(db: Db, socket: RoomSocket, auth: SocketAuth, slug: string): void {
  const channel = findEnabledChannelBySlug(db, auth.eventId, slug);
  if (channel) socket.leave(channelRoom(channel.id));
}
