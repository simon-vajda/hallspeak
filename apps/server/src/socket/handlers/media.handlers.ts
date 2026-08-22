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

/**
 * The contract validates mediasoup's capability, ICE, DTLS and RTP structures as opaque
 * objects — it compiles with no DOM and cannot import mediasoup. This layer is where the
 * wire shape becomes a mediasoup type, so the cast lives here once rather than at every
 * call site. mediasoup validates the contents itself and rejects a malformed blob.
 */
type Wire = Record<string, unknown>;
const asMediasoup = <T>(value: Wire): T => value as T;

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
  payload: { transportId: string; dtlsParameters: Wire },
) {
  await media.connectTransport(
    ctx(socket, auth),
    payload.transportId,
    asMediasoup<types.DtlsParameters>(payload.dtlsParameters),
  );
  return {};
}

export async function startProducing(
  db: Db,
  socket: MediaSocket,
  auth: SocketAuth,
  payload: { slug: string; rtpParameters: Wire; paused: boolean },
) {
  const channel = channelOrThrow(db, auth, payload.slug);
  // Holding the claim is the whole authorization to broadcast; the handshake took it.
  if (auth.speakerChannelId !== channel.id) {
    throw new AppError('not_speaker', 'This session may not broadcast on that channel.');
  }
  return media.produce(ctx(socket, auth), {
    channelId: channel.id,
    slug: channel.slug,
    rtpParameters: asMediasoup<types.RtpParameters>(payload.rtpParameters),
    paused: payload.paused,
  });
}

/**
 * The channel this session may act on a producer for. Every producer verb goes through
 * here: the consume ack hands a producer id to every listener on the event, so resolving
 * one by id alone would let anybody with the PIN silence any channel.
 */
function claimedChannel(auth: SocketAuth): number {
  if (auth.speakerChannelId === null) {
    throw new AppError('not_speaker', 'This session may not broadcast.');
  }
  return auth.speakerChannelId;
}

export async function pauseProducing(
  socket: MediaSocket,
  auth: SocketAuth,
  payload: { producerId: string },
) {
  await media.pauseProducer(ctx(socket, auth), claimedChannel(auth), payload.producerId);
  return {};
}

export async function resumeProducing(
  socket: MediaSocket,
  auth: SocketAuth,
  payload: { producerId: string },
) {
  await media.resumeProducer(ctx(socket, auth), claimedChannel(auth), payload.producerId);
  return {};
}

export async function stopProducing(
  socket: MediaSocket,
  auth: SocketAuth,
  payload: { producerId: string },
) {
  await media.closeProducer(ctx(socket, auth), claimedChannel(auth), payload.producerId);
  return {};
}

export async function startConsuming(
  db: Db,
  socket: MediaSocket,
  auth: SocketAuth,
  payload: { slug: string; rtpCapabilities: Wire },
) {
  const channel = channelOrThrow(db, auth, payload.slug);
  return media.consume(ctx(socket, auth), {
    channelId: channel.id,
    rtpCapabilities: asMediasoup<types.RtpCapabilities>(payload.rtpCapabilities),
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
