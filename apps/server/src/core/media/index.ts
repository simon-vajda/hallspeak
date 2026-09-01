import type { types } from 'mediasoup';
import { AppError } from '../../lib/problem';
import { type EvictionReason, notifications } from '../notifications';
import { presence } from '../presence';
import { reports } from '../reports';
import { type AddressResolver, AnnouncedAddress } from './announced-address';
import {
  augmentCandidates,
  type IceServer,
  iceServersFor,
  isUnroutableAnnouncedAddress,
  type MediaNetworkConfig,
  mintTurnCredential,
  type TurnConfig,
} from './config';
import { watchConsumer, watchProducer } from './diagnostics';
import { ListenerCountPublisher } from './listeners';
import type { TransportDirection } from './peer';
import { discoverReflexiveAddress, reflexiveMismatch } from './reflexive-address';
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
  resolveAddress?: AddressResolver;
  addressPollMs?: number;
  /** Off by default so a test never sends a datagram; `index.ts` turns it on. */
  probeReflexiveAddress?: boolean;
}

interface MediaState {
  pool: WorkerPool;
  registry: RoomRegistry;
  turn: TurnConfig;
  listeners: ListenerCountPublisher;
  announced: AnnouncedAddress;
}

// A module singleton, like `db`: handlers and admin routes reach it by import rather than
// by injection, which is this codebase's standing choice.
let state: MediaState | null = null;

/**
 * Started before the HTTP server listens, so a pool that cannot start is a boot failure
 * rather than a runtime surprise. A worker dying later is deliberately not fatal.
 */
export async function startMedia(options: StartMediaOptions): Promise<void> {
  if (state) {
    throw new Error('startMedia called twice');
  }

  // Before the pool, because the address is baked into every worker's listen infos: a
  // hostname that cannot be resolved is a boot failure rather than a deployment that
  // starts and carries no audio to half its guests.
  const announced = new AnnouncedAddress({
    configured: options.net.announcedIp,
    resolve: options.resolveAddress,
    pollMs: options.addressPollMs,
  });
  const announcedIp = await announced.start();
  if (announcedIp !== options.net.announcedIp) {
    console.log(`mediasoup: ${options.net.announcedIp} resolved to ${announcedIp}`);
  }

  const turnConfigured = Boolean(options.turn.turnUrl && options.turn.turnSecret);
  // The configured value is what the workers announce, hostname and all: `createTransport`
  // adds the resolved literal to every candidate list, so both forms reach the client and
  // the announced value never moves.
  const pool = new WorkerPool({
    net: options.net,
    turnConfigured,
    hostCpuCount: options.hostCpuCount,
    createWorker: options.createWorker,
  });
  await pool.start();
  console.log(pool.startupSummary(announcedIp));

  const listeners = new ListenerCountPublisher({
    // A recount rather than a delta, and a room that has gone answers zero: the window is
    // trailing, so it routinely fires after the room it names was torn down.
    count: (eventId, channelId) => listenerCount(eventId, channelId),
  });

  const registry = new RoomRegistry(pool, {
    graceMs: options.graceMs,
    onRoomClosed: (room, reason) => {
      // The remembered counts must not outlive the room: kept, they would suppress the
      // first real count of the next broadcast on the same channel.
      listeners.forgetEvent(room.eventId);
      reports.forgetEvent(room.eventId);
      // Idle and shutdown take nobody's access away, so nothing is evicted for them.
      if (reason === 'worker_died') {
        notifications.publish({ type: 'room-evicted', eventId: room.eventId, reason });
      }
    },
  });

  state = { pool, registry, turn: options.turn, listeners, announced };

  if (isUnroutableAnnouncedAddress(announcedIp)) {
    console.warn(
      `mediasoup: guests are told to connect to ${announcedIp}, which is a private or ` +
        'loopback address; nobody outside this machine can reach it. Set PUBLIC_ADDRESS.',
    );
    return;
  }

  // Never awaited: the answer is a log line and nothing reads it, so a STUN server that is
  // slow or gone must not hold up the listener. Only worth asking when the address looks
  // usable — the warning above already covers the case where it does not.
  const stunUrl = options.turn.stunUrl;
  if (!options.probeReflexiveAddress || !stunUrl) {
    return;
  }
  const crossCheck = (address: string) => {
    void discoverReflexiveAddress(stunUrl).then((reflexive) => {
      const mismatch = reflexiveMismatch(address, reflexive);
      if (mismatch) {
        console.warn(mismatch);
      }
    });
  };
  crossCheck(announcedIp);
  // The only startup check a move can meaningfully re-run: `AnnouncedAddress.refresh`
  // already filters unroutable answers before it notifies, so the warning above could
  // never fire from here. Nothing is rebuilt — the announced address no longer moves.
  announced.onChange(crossCheck);
}

export async function stopMedia(): Promise<void> {
  if (!state) {
    return;
  }
  const { pool, registry, listeners, announced } = state;
  // Nulled first, so every consumer closed inside closeAll() finds `scheduleRecount` inert
  // rather than scheduling a fresh window behind a drain that already ran.
  state = null;
  announced.close();
  await registry.closeAll();
  listeners.close();
  reports.close();
  await pool.close();
}

/** Cancels a scheduled teardown for a room that is being reused rather than created. */
function keepAlive(eventId: number): void {
  state?.registry.touch(eventId);
}

function require_(): MediaState {
  if (!state) {
    throw new AppError('media_unavailable', 'Media is not available.');
  }
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

/** Current producer existence and pause state, read together so they cannot disagree. */
export function channelStatus(
  eventId: number,
  channelId: number,
): { online: boolean; muted: boolean } {
  return state?.registry.get(eventId)?.channelStatus(channelId) ?? { online: false, muted: false };
}

/**
 * A listener is a guest holding an open, locally unpaused consumer on the channel's
 * producer — somebody receiving audio, not somebody with a page open. Structurally zero
 * until the interpreter goes live, which is the intended reading.
 */
export function listenerCount(eventId: number, channelId: number): number {
  return state?.registry.get(eventId)?.listenerCount(channelId) ?? 0;
}

/** `core/`'s own shape. The contract's DTO is the HTTP mapper's business, not this layer's. */
export interface ChannelListenerCount {
  channelId: number;
  slug: string;
  count: number;
}

export interface EventListenerCounts {
  eventId: number;
  channels: ChannelListenerCount[];
}

/** Every live channel of every active room with its count, for the admin read. */
export function listenerCounts(): EventListenerCounts[] {
  return (state?.registry.all() ?? []).map((room) => ({
    eventId: room.eventId,
    channels: room.liveChannels().map(({ channelId, slug }) => ({
      channelId,
      slug,
      count: room.listenerCount(channelId),
    })),
  }));
}

/**
 * The one poke every change goes through. Inert once the media layer has stopped, which is
 * what keeps the shutdown path from scheduling a window nothing will ever clear.
 */
function scheduleRecount(eventId: number, channelId: number, slug: string): void {
  state?.listeners.schedule(eventId, channelId, slug);
}

// --- signalling ---------------------------------------------------------------

/**
 * `create` is what keeps a room from existing before anyone has gone live: only a caller
 * holding the broadcast claim may bring a router into being, so a guest waiting on an
 * offline Channel allocates nothing on either side.
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
  // Taken before the awaits: a shutdown landing in that window would otherwise throw
  // `media_unavailable` at a caller whose transport was already created.
  const { announced } = require_();
  const room = await roomFor(ctx.eventId, options.create);
  const transport = await room.createTransport(ctx.socketId, direction);
  return {
    id: transport.id,
    iceParameters: transport.iceParameters,
    // Both address forms: mediasoup announced the configured one, and the literal it
    // currently resolves to is added here. See `augmentCandidates`.
    iceCandidates: augmentCandidates(transport.iceCandidates, announced.current),
    dtlsParameters: transport.dtlsParameters,
  };
}

export async function connectTransport(
  ctx: MediaContext,
  transportId: string,
  dtlsParameters: types.DtlsParameters,
): Promise<void> {
  const transport = transportOrThrow(ctx, transportId);
  await transport.connect({ dtlsParameters });
}

export async function restartIce(
  ctx: MediaContext,
  transportId: string,
): Promise<{ iceParameters: types.IceParameters }> {
  return { iceParameters: await transportOrThrow(ctx, transportId).restartIce() };
}

/**
 * The client rebuilding its peer connection after a network handoff. Unknown is a no-op,
 * as everywhere a client releases something it may be racing.
 */
export function closeTransport(ctx: MediaContext, transportId: string): void {
  state?.registry.get(ctx.eventId)?.peer(ctx.socketId)?.closeTransport(transportId);
}

function transportOrThrow(ctx: MediaContext, transportId: string): types.WebRtcTransport {
  const transport = peerOrThrow(ctx).transportById(transportId);
  if (!transport) {
    throw new AppError('no_transport', 'No such transport on this session.');
  }
  return transport;
}

export interface ProduceInput {
  channelId: number;
  slug: string;
  rtpParameters: types.RtpParameters;
  paused: boolean;
}

export async function produce(
  ctx: MediaContext,
  input: ProduceInput,
): Promise<{ producerId: string }> {
  const room = await roomFor(ctx.eventId, true);
  const transport = room.peerFor(ctx.socketId).transport('send');
  if (!transport) {
    throw new AppError('no_transport', 'Create a send transport first.');
  }

  const producer = await transport.produce({
    kind: 'audio',
    rtpParameters: input.rtpParameters,
    paused: input.paused,
    appData: { channelId: input.channelId, slug: input.slug },
  });

  room.setProducer(input.channelId, producer);
  watchProducer(producer, ctx.eventId, input.slug);
  producer.observer.once('close', () => {
    const appData = producer.appData as { closeReason?: unknown };
    notifications.publish({
      type: 'producer-closed',
      eventId: ctx.eventId,
      channelId: input.channelId,
      slug: input.slug,
      reason: appData.closeReason === 'ended' ? 'ended' : 'dropped',
    });
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

export async function pauseProducer(
  ctx: MediaContext,
  channelId: number,
  producerId: string,
): Promise<void> {
  const { producer, slug } = producerWithSlugOrThrow(ctx, channelId, producerId);
  await producer.pause();
  notifications.publish({
    type: 'producer-paused',
    eventId: ctx.eventId,
    channelId,
    slug,
  });
}

export async function resumeProducer(
  ctx: MediaContext,
  channelId: number,
  producerId: string,
): Promise<void> {
  const { producer, slug } = producerWithSlugOrThrow(ctx, channelId, producerId);
  await producer.resume();
  notifications.publish({
    type: 'producer-resumed',
    eventId: ctx.eventId,
    channelId,
    slug,
  });
}

export async function closeProducer(
  ctx: MediaContext,
  channelId: number,
  producerId: string,
): Promise<void> {
  const producer = state?.registry.get(ctx.eventId)?.producer(channelId);
  // A close that finds nothing has already achieved what it asked for. Scoped to the
  // caller's own channel, so a wrong id can never reach somebody else's producer.
  if (!producer || producer.id !== producerId) {
    return;
  }
  (producer.appData as { closeReason?: 'ended' }).closeReason = 'ended';
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
  const peer = room.peerFor(ctx.socketId);
  const transport = peer.transport('recv');
  if (!transport) {
    throw new AppError('no_transport', 'Create a receive transport first.');
  }

  // A repeated consume of the same channel returns what this peer already holds. Left
  // uncapped, one PIN holder could fan a channel out as many times as they asked.
  const existing = peer.consumerForProducer(producer.id);
  if (existing) {
    return {
      consumerId: existing.id,
      producerId: producer.id,
      kind: 'audio',
      rtpParameters: existing.rtpParameters,
    };
  }

  if (
    !room.router.canConsume({ producerId: producer.id, rtpCapabilities: input.rtpCapabilities })
  ) {
    throw new AppError('incompatible_client', 'This device cannot play that audio.');
  }

  // Created paused because unpaused RTP races the client's decoder setup, which is the
  // most commonly reported cause of artefacts at join.
  const slug = room.producerSlug(input.channelId) ?? '';
  const consumer = await transport.consume({
    producerId: producer.id,
    rtpCapabilities: input.rtpCapabilities,
    paused: true,
    // The consumer carries its own channel, so a resume or a close can name the affected
    // channel without a reverse lookup through the room's producers.
    appData: { channelId: input.channelId, slug },
  });
  peer.addConsumer(consumer);
  // One hook covers stopping playback, a language switch, a disconnect, a peer eviction, a dead
  // worker and the producer closing alike: mediasoup closes the consumer for all of them.
  // Registered here and not on the early-return path above, which hands back a consumer
  // that already has one.
  consumer.observer.once('close', () => scheduleRecount(ctx.eventId, input.channelId, slug));

  return {
    consumerId: consumer.id,
    producerId: producer.id,
    kind: 'audio',
    rtpParameters: consumer.rtpParameters,
  };
}

export async function resumeConsumer(ctx: MediaContext, consumerId: string): Promise<void> {
  const consumer = peerOrThrow(ctx).consumerById(consumerId);
  if (!consumer) {
    throw new AppError('no_consumer', 'No such consumer on this session.');
  }
  await consumer.resume();
  // The other half of the count: a resume is the moment a guest starts hearing anything.
  const { channelId, slug } = consumerChannel(consumer);
  watchConsumer(consumer, ctx.eventId, slug);
  if (channelId !== undefined) {
    scheduleRecount(ctx.eventId, channelId, slug);
  }
}

function consumerChannel(consumer: types.Consumer): { channelId?: number; slug: string } {
  const appData = consumer.appData as { channelId?: unknown; slug?: unknown };
  return {
    channelId: typeof appData.channelId === 'number' ? appData.channelId : undefined,
    slug: typeof appData.slug === 'string' ? appData.slug : '',
  };
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

  reports.forgetChannel(eventId, channelId);

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
 * registered — and a listener who owns no media is invisible here, which is exactly who a
 * regenerated PIN must remove.
 */
export function revokeEvent(eventId: number, channelIds: number[], reason: EvictionReason): void {
  for (const channelId of channelIds) {
    presence.releaseChannel(channelId);
    reports.forgetChannel(eventId, channelId);
  }
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
  // Reuse cancels the grace timer too. Only getOrCreate used to, so a speaker returning
  // late in the grace period could be handed capabilities on a router about to close.
  if (existing) {
    keepAlive(eventId);
    return existing;
  }
  if (!create) {
    throw new AppError('not_live', 'Nobody is broadcasting on this event.');
  }
  return registry.getOrCreate(eventId);
}

function roomOrThrow(eventId: number): Room {
  const room = require_().registry.get(eventId);
  if (!room) {
    throw new AppError('not_live', 'Nobody is broadcasting on this event.');
  }
  keepAlive(eventId);
  return room;
}

function peerOrThrow(ctx: MediaContext) {
  const peer = roomOrThrow(ctx.eventId).peer(ctx.socketId);
  if (!peer) {
    throw new AppError('no_transport', 'This session holds no media.');
  }
  return peer;
}

/**
 * Looked up by the caller's own channel and only then matched on id, never by id across
 * the event: the id is public to every listener the moment they consume.
 */
function producerWithSlugOrThrow(
  ctx: MediaContext,
  channelId: number,
  producerId: string,
): { producer: types.Producer; slug: string } {
  const room = roomOrThrow(ctx.eventId);
  const producer = room.producer(channelId);
  if (!producer || producer.id !== producerId) {
    throw new AppError('no_producer', 'No such producer on this channel.');
  }
  return { producer, slug: room.producerSlug(channelId) ?? '' };
}
