import type { ReportCategory } from '@linguacast/contract/socket';
import type { SocketAuth } from '../../core/access';
import { findEnabledChannelBySlug, getChannelById } from '../../core/channels.service';
import * as media from '../../core/media';
import { reports } from '../../core/reports';
import type { Db } from '../../db/client';
import { AppError } from '../../lib/problem';
import { channelRoom } from '../lib/rooms';

/** The subset of Socket this module needs; a real Socket satisfies it. */
export interface ReportingSocket {
  id: string;
  rooms: ReadonlySet<string>;
}

/** The subset of Socket the connect-time tally needs; a real Socket satisfies it. */
export interface ReportsSocket {
  emit(
    event: 'channel:reports',
    payload: {
      slug: string;
      rows: { category: ReportCategory; count: number; ageMs: number }[];
      soundsGood: { count: number; ageMs: number } | null;
    },
  ): unknown;
}

/**
 * Every guard is the server's, because a reload clears every client-side one: the sheet's
 * two-minute disable is a courtesy on top of this, not the rule.
 *
 * The slug resolves against the socket's own event, so a socket authorized for event A
 * cannot report on a channel of event B and there is no ownership check to forget. A
 * socket that never joined the channel gets the same `not_found` an unknown slug does, so
 * room membership is not probeable.
 */
export function submitReport(
  db: Db,
  socket: ReportingSocket,
  auth: SocketAuth,
  { slug, category }: { slug: string; category: ReportCategory },
): Record<string, never> {
  const channel = findEnabledChannelBySlug(db, auth.eventId, slug);
  if (!channel || !socket.rooms.has(channelRoom(channel.id))) {
    throw new AppError('not_found', `No channel "${slug}" on this event.`);
  }

  if (!media.isOnline(auth.eventId, channel.id)) {
    throw new AppError('channel_offline', 'Nobody is broadcasting on this channel right now.');
  }

  if (reports.record(auth.eventId, channel.id, slug, socket.id, category) === 'too_soon') {
    throw new AppError('too_soon', 'You have already reported this. Try again in a few minutes.');
  }

  return {};
}

/** Clears this connection's open problem reports and adds one positive confirmation. */
export function resolveReports(
  db: Db,
  socket: ReportingSocket,
  auth: SocketAuth,
  { slug }: { slug: string },
): Record<string, never> {
  const channel = findEnabledChannelBySlug(db, auth.eventId, slug);
  if (!channel || !socket.rooms.has(channelRoom(channel.id))) {
    throw new AppError('not_found', `No channel "${slug}" on this event.`);
  }

  if (!media.isOnline(auth.eventId, channel.id)) {
    throw new AppError('channel_offline', 'Nobody is broadcasting on this channel right now.');
  }

  if (reports.resolve(auth.eventId, channel.id, socket.id) === 'not_open') {
    throw new AppError('no_open_report', 'Report a problem before confirming that audio is good.');
  }

  return {};
}

/**
 * A studio that reconnects or reloads while reports are live must not read an empty panel,
 * so it is told the current tally on connect. It is sent whether or not there are rows:
 * an empty window and one the studio has never heard are different states, and only the
 * arrival of this message separates them.
 */
export function sendInitialReports(db: Db, socket: ReportsSocket, auth: SocketAuth): void {
  const channelId = auth.speakerChannelId;
  if (channelId === null) {
    return;
  }

  // `socket.data` carries no slug, so the wire's identifier is read back off the row.
  const channel = getChannelById(db, channelId);
  if (!channel) {
    return;
  }

  socket.emit('channel:reports', {
    slug: channel.slug,
    ...reports.snapshot(auth.eventId, channelId),
  });
}
