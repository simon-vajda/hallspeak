import type { types } from 'mediasoup';
import { AppError } from '../../lib/problem';
import { type EvictionReason, notifications } from '../notifications';
import { presence } from '../presence';
import {
  type IceServer,
  iceServersFor,
  isUnroutableAnnouncedAddress,
  type MediaNetworkConfig,
  mintTurnCredential,
  type TurnConfig,
} from './config';
import type { TransportDirection } from './peer';
import { RoomRegistry } from './registry';
import type { Room } from './room';
import { type WorkerFactory, WorkerPool } from './workers';

/** Short enough that a leaked credential is worthless before anyone could use it. */
const TURN_CREDENTIAL_TTL_SECONDS = 3600;

export interface MediaContext {
  eventId: number;
  socketId: string;
}

export interface StartMediaOptions {
  net: MediaNetworkConfig;
  turn: TurnConfig;
  graceMs?: number;
  hostCpuCount?: number;
  createWorker?: WorkerFactory;
}

interface MediaState {
  pool: WorkerPool;
  registry: RoomRegistry;
  turn: TurnConfig;
}

// A module singleton, like `db`: handlers and admin routes reach it by import rather than
// by injection, which is this codebase's standing choice.
let state: MediaState | null = null;

/**
 * Started before the HTTP server listens, so a pool that cannot start is a boot failure
 * rather than a runtime surprise. A worker dying later is deliberately not fatal.
 */
export async function startMedia(options: StartMediaOptions): Promise<void> {
  if (state) throw new Error('startMedia called twice');

  const turnConfigured = Boolean(options.turn.turnUrl && options.turn.turnSecret);
  const pool = new WorkerPool({
    net: options.net,
    turnConfigured,
    hostCpuCount: options.hostCpuCount,
    createWorker: options.createWorker,
  });
  await pool.start();

  const registry = new RoomRegistry(pool, {
    graceMs: options.graceMs,
    onRoomClosed: (room, reason) => {
      // Idle and shutdown take nobody's access away, so nothing is evicted for them.
      if (reason === 'worker_died') {
        notifications.publish({ type: 'room-evicted', eventId: room.eventId, reason });
      }
    },
  });

  state = { pool, registry, turn: options.turn };

  if (isUnroutableAnnouncedAddress(options.net.announcedIp)) {
    console.warn(
      `mediasoup: announced address ${options.net.announcedIp} is private or loopback; ` +
        'clients off this machine will produce candidates nobody can reach',
    );
  }
}

export async function stopMedia(): Promise<void> {
  if (!state) return;
  const { pool, registry } = state;
  state = null;
  await registry.closeAll();
  await pool.close();
}

function require_(): MediaState {
  if (!state) throw new AppError('media_unavailable', 'Media is not available.');
  return state;
}

// --- liveness ----------------------------------------------------------------

/**
 * A channel is live while an unclosed producer exists — not while a studio is open and
 * not while a speaker holds the claim. Mute pauses the producer, so it does not change
 * this. Replaces the claim-derived answer `core/presence.ts` used to give.
 */
export function isOnline(eventId: number, channelId: number): boolean {
  return state?.registry.get(eventId)?.isOnline(channelId) ?? false;
}

// --- signalling ---------------------------------------------------------------

/**
 * `create` is what keeps a room from existing before anyone has gone live: only a caller
 * holding the broadcast claim may bring a router into being, so a guest arming early
 * allocates nothing on either side.
 */
export async function capabilities(
  ctx: MediaContext,
  options: { create: boolean },
): Promise<{ routerRtpCapabilities: types.RtpCapabilities; iceServers: IceServer[] }> {
  const room = await roomFor(ctx.eventId, options.create);
  return {
    routerRtpCapabilities: room.router.rtpCapabilities,
    iceServers: iceServers(),
  };
}

/** Minted per session with a short life: a standing credential given to every guest is a relay. */
function iceServers(): IceServer[] {
  const { turn } = require_();
  return iceServersFor(turn, (secret) => mintTurnCredential(secret, TURN_CREDENTIAL_TTL_SECONDS));
}

export interface TransportDescription {
  id: string;
  iceParameters: types.IceParameters;
  iceCandidates: types.IceCandidate[];
  dtlsParameters: types.DtlsParameters;
}

export async function createTransport(
  ctx: MediaContext,
  direction: TransportDirection,
  options: { create: boolean },
): Promise<TransportDescription> {
  const room = await roomFor(ctx.eventId, options.create);
  const transport = await room.createTransport(ctx.socketId, direction);
  return {
    id: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters,
  };
}

export async function connectTransport(
  ctx: MediaContext,
  transportId: string,
  dtlsParameters: types.DtlsParameters,
): Promise<void> {
  const transport = peerOrThrow(ctx).transportById(transportId);
  if (!transport) throw new AppError('no_transport', 'No such transport on this session.');
  await transport.connect({ dtlsParameters });
}

export interface ProduceInput {
  channelId: number;
  slug: string;
  rtpParameters: types.RtpParameters;
}

export async function produce(
  ctx: MediaContext,
  input: ProduceInput,
): Promise<{ producerId: string }> {
  const room = await roomFor(ctx.eventId, true);
  const transport = room.peerFor(ctx.socketId).transport('send');
  if (!transport) throw new AppError('no_transport', 'Create a send transport first.');

  const producer = await transport.produce({
    kind: 'audio',
    rtpParameters: input.rtpParameters,
    appData: { channelId: input.channelId, slug: input.slug },
  });

  room.setProducer(input.channelId, producer);
  const closed = {
    type: 'producer-closed',
    eventId: ctx.eventId,
    channelId: input.channelId,
    slug: input.slug,
  } as const;
  producer.observer.once('close', () => {
    notifications.publish(closed);
    // The room may now be idle; the grace timer decides whether the router survives.
    state?.registry.releaseIfIdle(ctx.eventId);
  });

  notifications.publish({
    type: 'producer-opened',
    eventId: ctx.eventId,
    channelId: input.channelId,
    slug: input.slug,
  });
  return { producerId: producer.id };
}

export async function pauseProducer(ctx: MediaContext, producerId: string): Promise<void> {
  await producerOrThrow(ctx, producerId).pause();
}

export async function resumeProducer(ctx: MediaContext, producerId: string): Promise<void> {
  await producerOrThrow(ctx, producerId).resume();
}

export async function closeProducer(ctx: MediaContext, producerId: string): Promise<void> {
  const room = state?.registry.get(ctx.eventId);
  const producer = room?.producerById(producerId);
  // A close that finds nothing has already achieved what it asked for.
  if (!producer) return;
  producer.close();
}

export interface ConsumeInput {
  channelId: number;
  rtpCapabilities: types.RtpCapabilities;
}

export async function consume(
  ctx: MediaContext,
  input: ConsumeInput,
): Promise<{
  consumerId: string;
  producerId: string;
  kind: 'audio';
  rtpParameters: types.RtpParameters;
}> {
  const room = roomOrThrow(ctx.eventId);
  const producer = room.producer(input.channelId);
  if (!producer || producer.closed) {
    throw new AppError('not_live', 'Nobody is broadcasting on that channel.');
  }
  const transport = room.peerFor(ctx.socketId).transport('recv');
  if (!transport) throw new AppError('no_transport', 'Create a receive transport first.');

  if (
    !room.router.canConsume({ producerId: producer.id, rtpCapabilities: input.rtpCapabilities })
  ) {
    throw new AppError('incompatible_client', 'This device cannot play that audio.');
  }

  // Paused, per KTD13: unpaused races RTP against the client's decoder setup, which is
  // the most commonly reported cause of artefacts at join.
  const consumer = await transport.consume({
    producerId: producer.id,
    rtpCapabilities: input.rtpCapabilities,
    paused: true,
  });
  room.peerFor(ctx.socketId).addConsumer(consumer);

  return {
    consumerId: consumer.id,
    producerId: producer.id,
    kind: 'audio',
    rtpParameters: consumer.rtpParameters,
  };
}

export async function resumeConsumer(ctx: MediaContext, consumerId: string): Promise<void> {
  const consumer = peerOrThrow(ctx).consumerById(consumerId);
  if (!consumer) throw new AppError('no_consumer', 'No such consumer on this session.');
  await consumer.resume();
}

export async function closeConsumer(ctx: MediaContext, consumerId: string): Promise<void> {
  state?.registry.get(ctx.eventId)?.peer(ctx.socketId)?.closeConsumer(consumerId);
}

// --- revocation ---------------------------------------------------------------

/**
 * Channel-scoped: disabling or deleting a channel, or regenerating its speaker code. Only
 * the claim holder loses access, so only they are evicted — a listener's PIN is untouched
 * and their consumer dies with the producer anyway.
 */
export function revokeChannel(eventId: number, channelId: number, reason: EvictionReason): void {
  const room = state?.registry.get(eventId);
  room?.closeProducer(channelId);

  const holder = presence.releaseChannel(channelId);
  if (holder) {
    room?.closePeer(holder);
    notifications.publish({ type: 'peer-evicted', socketId: holder, reason });
  }
  state?.registry.releaseIfIdle(eventId);
}

/**
 * Event-scoped: disabling an event or regenerating its PIN. Published once as a room fact
 * rather than as one eviction per known peer, because `core/` can only name a socket it
 * registered — and a listener who armed nothing is invisible here, which is exactly who a
 * regenerated PIN must remove.
 */
export function revokeEvent(eventId: number, channelIds: number[], reason: EvictionReason): void {
  for (const channelId of channelIds) presence.releaseChannel(channelId);
  state?.registry.closeEvent(eventId, 'revoked');
  notifications.publish({ type: 'room-evicted', eventId, reason });
}

/** The disconnect half: this socket's media goes, and nobody else's. */
export function releasePeer(eventId: number, socketId: string): void {
  state?.registry.get(eventId)?.closePeer(socketId);
  state?.registry.releaseIfIdle(eventId);
}

/** For the shutdown path and for tests that need to see what is still up. */
export function activeRooms(): Room[] {
  return state?.registry.all() ?? [];
}

// --- internals ----------------------------------------------------------------

async function roomFor(eventId: number, create: boolean): Promise<Room> {
  const { registry } = require_();
  const existing = registry.get(eventId);
  if (existing) return existing;
  if (!create) throw new AppError('not_live', 'Nobody is broadcasting on this event.');
  return registry.getOrCreate(eventId);
}

function roomOrThrow(eventId: number): Room {
  const room = require_().registry.get(eventId);
  if (!room) throw new AppError('not_live', 'Nobody is broadcasting on this event.');
  return room;
}

function peerOrThrow(ctx: MediaContext) {
  const peer = roomOrThrow(ctx.eventId).peer(ctx.socketId);
  if (!peer) throw new AppError('no_transport', 'This session holds no media.');
  return peer;
}

function producerOrThrow(ctx: MediaContext, producerId: string): types.Producer {
  const producer = roomOrThrow(ctx.eventId).producerById(producerId);
  if (!producer) throw new AppError('no_producer', 'No such producer on this event.');
  return producer;
}
