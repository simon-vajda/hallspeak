import type { types } from 'mediasoup';
import type { SocketAuth } from '../../core/access';
import { findEnabledChannelBySlug } from '../../core/channels.service';
import * as media from '../../core/media';
import type { Db } from '../../db/client';
import { AppError } from '../../lib/problem';

/** The subset of Socket this module needs; a real Socket satisfies it. */
export interface MediaSocket {
  id: string;
}

function ctx(socket: MediaSocket, auth: SocketAuth): media.MediaContext {
  return { eventId: auth.eventId, socketId: socket.id };
}

/**
 * A speaker may bring a room into being; a listener may not. That is the whole of R6 at
 * this layer — a guest arming before anyone is live allocates nothing on either side.
 */
function mayCreateRoom(auth: SocketAuth): boolean {
  return auth.speakerChannelId !== null;
}

/** The slug resolves against the socket's own event, so a foreign channel does not exist. */
function channelOrThrow(db: Db, auth: SocketAuth, slug: string) {
  const channel = findEnabledChannelBySlug(db, auth.eventId, slug);
  if (!channel) throw new AppError('not_found', `No channel "${slug}" on this event.`);
  return channel;
}

export function getCapabilities(socket: MediaSocket, auth: SocketAuth) {
  return media.capabilities(ctx(socket, auth), { create: mayCreateRoom(auth) });
}

export async function openTransport(
  socket: MediaSocket,
  auth: SocketAuth,
  payload: { direction: 'send' | 'recv' },
) {
  if (payload.direction === 'send' && auth.speakerChannelId === null) {
    throw new AppError('not_speaker', 'This session may not broadcast.');
  }
  return media.createTransport(ctx(socket, auth), payload.direction, {
    create: mayCreateRoom(auth),
  });
}

export async function connectTransport(
  socket: MediaSocket,
  auth: SocketAuth,
  payload: { transportId: string; dtlsParameters: types.DtlsParameters },
) {
  await media.connectTransport(ctx(socket, auth), payload.transportId, payload.dtlsParameters);
  return {};
}

export async function startProducing(
  db: Db,
  socket: MediaSocket,
  auth: SocketAuth,
  payload: { slug: string; rtpParameters: types.RtpParameters },
) {
  const channel = channelOrThrow(db, auth, payload.slug);
  // Holding the claim is the whole authorization to broadcast; the handshake took it.
  if (auth.speakerChannelId !== channel.id) {
    throw new AppError('not_speaker', 'This session may not broadcast on that channel.');
  }
  return media.produce(ctx(socket, auth), {
    channelId: channel.id,
    slug: channel.slug,
    rtpParameters: payload.rtpParameters,
  });
}

export async function pauseProducing(
  socket: MediaSocket,
  auth: SocketAuth,
  payload: { producerId: string },
) {
  await media.pauseProducer(ctx(socket, auth), payload.producerId);
  return {};
}

export async function resumeProducing(
  socket: MediaSocket,
  auth: SocketAuth,
  payload: { producerId: string },
) {
  await media.resumeProducer(ctx(socket, auth), payload.producerId);
  return {};
}

export async function stopProducing(
  socket: MediaSocket,
  auth: SocketAuth,
  payload: { producerId: string },
) {
  await media.closeProducer(ctx(socket, auth), payload.producerId);
  return {};
}

export async function startConsuming(
  db: Db,
  socket: MediaSocket,
  auth: SocketAuth,
  payload: { slug: string; rtpCapabilities: types.RtpCapabilities },
) {
  const channel = channelOrThrow(db, auth, payload.slug);
  return media.consume(ctx(socket, auth), {
    channelId: channel.id,
    rtpCapabilities: payload.rtpCapabilities,
  });
}

export async function resumeConsuming(
  socket: MediaSocket,
  auth: SocketAuth,
  payload: { consumerId: string },
) {
  await media.resumeConsumer(ctx(socket, auth), payload.consumerId);
  return {};
}

export async function stopConsuming(
  socket: MediaSocket,
  auth: SocketAuth,
  payload: { consumerId: string },
) {
  await media.closeConsumer(ctx(socket, auth), payload.consumerId);
  return {};
}
