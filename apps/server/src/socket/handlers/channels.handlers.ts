import type { SocketAuth } from '../../core/access';
import { findEnabledChannelBySlug } from '../../core/channels.service';
import { channelStatus } from '../../core/media';
import type { Db } from '../../db/client';
import { AppError } from '../../lib/problem';
import { channelRoom } from '../lib/rooms';

/** The subset of Socket this module needs; a real Socket satisfies it. */
export interface RoomSocket {
  join(room: string): void;
  leave(room: string): void;
}

/**
 * The slug resolves against the socket's own event, so a socket authorized for event A
 * cannot join a channel of event B and there is no ownership check to forget.
 */
export function joinChannel(
  db: Db,
  socket: RoomSocket,
  auth: SocketAuth,
  slug: string,
): { online: boolean; muted: boolean } {
  const channel = findEnabledChannelBySlug(db, auth.eventId, slug);
  if (!channel) {
    throw new AppError('not_found', `No channel "${slug}" on this event.`);
  }

  socket.join(channelRoom(channel.id));
  return channelStatus(auth.eventId, channel.id);
}

/** Fire-and-forget: a leave that resolves to nothing has already achieved its goal. */
export function leaveChannel(db: Db, socket: RoomSocket, auth: SocketAuth, slug: string): void {
  const channel = findEnabledChannelBySlug(db, auth.eventId, slug);
  if (channel) {
    socket.leave(channelRoom(channel.id));
  }
}
