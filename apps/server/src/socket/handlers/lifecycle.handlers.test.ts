import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SocketAuth } from '../../core/access';
import { createChannel } from '../../core/channels.service';
import { createEvent } from '../../core/events.service';
import { handover } from '../../core/handover';
import { listenerHistory } from '../../core/listener-history';
import {
  closeProducer,
  consume,
  createTransport,
  isOnline,
  pauseProducer,
  produce,
  resumeConsumer,
  resumeProducer,
} from '../../core/media';
import { goLive, startFakeMedia } from '../../core/media/testing';
import { presence } from '../../core/presence';
import type { Db } from '../../db/client';
import { createTestDb } from '../../db/testing';
import { channelRoom, eventRoom } from '../lib/rooms';
import {
  applyNotification,
  type LifecycleServer,
  releaseSocket,
  seedClaimAudience,
  sendInitialListenerCount,
  sendInitialListenerHistory,
} from './lifecycle.handlers';

/** The shape of a listener-history payload, reduced to what these tests assert on. */
const historyCounts = (payload: unknown) =>
  (payload as { points: { count: number }[] } | undefined)?.points.map((point) => point.count);

const EVENT = 1;
const ENGLISH = 10;
const STUDIO = 'studio-english';

function fakeIo() {
  const emitted: Array<{ room: string; event: string; payload: unknown }> = [];
  const disconnectedRooms: string[] = [];
  const disconnectedSockets: string[] = [];
  const sockets = new Map<string, { disconnect(close: boolean): void }>();

  const io: LifecycleServer = {
    to: (room: string) => ({
      emit: (event: string, payload: unknown) => {
        emitted.push({ room, event, payload });
      },
    }),
    in: (room: string) => ({
      disconnectSockets: () => {
        disconnectedRooms.push(room);
      },
    }),
    sockets: { sockets },
  };

  const addSocket = (id: string) => {
    sockets.set(id, {
      disconnect: () => {
        disconnectedSockets.push(id);
      },
    });
  };

  return { io, emitted, disconnectedRooms, disconnectedSockets, addSocket };
}

let stopMedia: () => Promise<void>;
let db: Db;
let closeDb: () => void;

beforeEach(async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  stopMedia = await startFakeMedia();
  ({ db, cleanup: closeDb } = createTestDb());
});

afterEach(async () => {
  await stopMedia();
  closeDb();
  presence.releaseChannel(ENGLISH);
  listenerHistory.close();
  vi.restoreAllMocks();
});

describe('releaseSocket', () => {
  const speaker: SocketAuth = {
    eventId: EVENT,
    pin: '111111',
    speakerChannelId: ENGLISH,
    studioSession: STUDIO,
  };

  it('closes a live producer and takes the channel offline', async () => {
    presence.take({ eventId: EVENT, channelId: ENGLISH, sessionId: STUDIO, socketId: 'speaker-a' });
    await goLive({
      eventId: EVENT,
      socketId: 'speaker-a',
      channelId: ENGLISH,
      slug: 'english',
      sessionId: STUDIO,
    });

    releaseSocket({ id: 'speaker-a' }, speaker);

    expect(isOnline(EVENT, ENGLISH)).toBe(false);
    expect(presence.holder(ENGLISH)).toBeUndefined();
  });

  it('keeps the on-air start for the colleague a dropped holder hands over to', () => {
    presence.take({ eventId: EVENT, channelId: ENGLISH, sessionId: STUDIO, socketId: 'speaker-a' });
    const startedAt = presence.claimOf(ENGLISH)?.startedAt;
    const colleague = {
      eventId: EVENT,
      channelId: ENGLISH,
      sessionId: 'studio-b',
      socketId: 'speaker-b',
    };
    presence.registerStudio(colleague);
    expect(handover.request(colleague)).toBe('accepted');

    vi.spyOn(Date, 'now').mockReturnValue((startedAt ?? 0) + 120_000);
    releaseSocket({ id: 'speaker-a' }, speaker);
    handover.produced(colleague);
    handover.complete(ENGLISH);

    expect(presence.claimOf(ENGLISH)).toMatchObject({ sessionId: 'studio-b', startedAt });
    handover.forgetChannel(ENGLISH);
    presence.release('speaker-b');
  });

  it('releases the claim and does nothing else for a session holding no media', () => {
    presence.take({ eventId: EVENT, channelId: ENGLISH, sessionId: STUDIO, socketId: 'speaker-a' });

    expect(() => releaseSocket({ id: 'speaker-a' }, speaker)).not.toThrow();
    expect(presence.holder(ENGLISH)).toBeUndefined();
  });

  it('is a no-op for a listener that held nothing at all', () => {
    const listener: SocketAuth = {
      eventId: EVENT,
      pin: '111111',
      speakerChannelId: null,
      studioSession: null,
    };

    expect(() => releaseSocket({ id: 'guest-a' }, listener)).not.toThrow();
  });

  it('leaves another speaker’s producer alone', async () => {
    await goLive({ eventId: EVENT, socketId: 'speaker-a', channelId: ENGLISH, slug: 'english' });
    await goLive({ eventId: EVENT, socketId: 'speaker-b', channelId: 11, slug: 'spanish' });

    releaseSocket({ id: 'speaker-a' }, speaker);

    expect(isOnline(EVENT, 11)).toBe(true);
  });
});

describe('applyNotification producer lifecycle', () => {
  it('broadcasts the current online and muted snapshot to the event room', async () => {
    const { io, emitted } = fakeIo();
    await goLive({ eventId: EVENT, socketId: 'speaker-a', channelId: ENGLISH, slug: 'english' });

    applyNotification(io, db, {
      type: 'producer-opened',
      eventId: EVENT,
      channelId: ENGLISH,
      slug: 'english',
    });

    expect(emitted).toMatchObject([
      {
        room: eventRoom(EVENT),
        event: 'channel:status',
        payload: { slug: 'english', online: true, muted: false },
      },
    ]);
  });

  it('broadcasts muted on the opened invalidation for an initially paused producer', async () => {
    const { io, emitted } = fakeIo();
    await createTransport({ eventId: EVENT, socketId: 'speaker-a' }, 'send', { create: true });
    await produce(
      { eventId: EVENT, socketId: 'speaker-a', sessionId: STUDIO },
      {
        channelId: ENGLISH,
        slug: 'english',
        rtpParameters: { codecs: [] },
        paused: true,
      },
    );

    applyNotification(io, db, {
      type: 'producer-opened',
      eventId: EVENT,
      channelId: ENGLISH,
      slug: 'english',
    });

    expect(emitted[0]?.payload).toMatchObject({ slug: 'english', online: true, muted: true });
    expect(emitted[0]?.room).toBe(eventRoom(EVENT));
  });

  it('broadcasts mute and resume without changing online', async () => {
    const { io, emitted } = fakeIo();
    const { producerId } = await goLive({
      eventId: EVENT,
      socketId: 'speaker-a',
      channelId: ENGLISH,
      slug: 'english',
    });
    const ctx = { eventId: EVENT, socketId: 'speaker-a' };
    await pauseProducer(ctx, ENGLISH, producerId);
    applyNotification(io, db, {
      type: 'producer-paused',
      eventId: EVENT,
      channelId: ENGLISH,
      slug: 'english',
    });
    await resumeProducer(ctx, ENGLISH, producerId);
    applyNotification(io, db, {
      type: 'producer-resumed',
      eventId: EVENT,
      channelId: ENGLISH,
      slug: 'english',
    });

    expect(emitted.map((entry) => entry.payload)).toMatchObject([
      { slug: 'english', online: true, muted: true },
      { slug: 'english', online: true, muted: false },
    ]);
    expect(emitted.map((entry) => entry.room)).toEqual([
      channelRoom(ENGLISH),
      channelRoom(ENGLISH),
    ]);
  });

  it('broadcasts offline and clears muted when a paused producer closes', async () => {
    const { io, emitted } = fakeIo();
    const { producerId } = await goLive({
      eventId: EVENT,
      socketId: 'speaker-a',
      channelId: ENGLISH,
      slug: 'english',
    });
    await pauseProducer({ eventId: EVENT, socketId: 'speaker-a' }, ENGLISH, producerId);
    await closeProducer({ eventId: EVENT, socketId: 'speaker-a' }, ENGLISH, producerId);

    applyNotification(io, db, {
      type: 'producer-closed',
      eventId: EVENT,
      channelId: ENGLISH,
      slug: 'english',
      reason: 'ended',
    });

    expect(emitted[0]?.payload).toEqual({
      slug: 'english',
      online: false,
      muted: false,
      producerId: null,
      incomingProducerId: null,
      reason: 'ended',
    });
    expect(emitted[0]?.room).toBe(eventRoom(EVENT));
  });

  it('keeps a late pause invalidation offline after its producer closed', async () => {
    const { io, emitted } = fakeIo();
    const { producerId } = await goLive({
      eventId: EVENT,
      socketId: 'speaker-a',
      channelId: ENGLISH,
      slug: 'english',
    });
    await closeProducer({ eventId: EVENT, socketId: 'speaker-a' }, ENGLISH, producerId);

    applyNotification(io, db, {
      type: 'producer-paused',
      eventId: EVENT,
      channelId: ENGLISH,
      slug: 'english',
    });

    expect(emitted[0]?.payload).toEqual({
      slug: 'english',
      online: false,
      muted: false,
      producerId: null,
      incomingProducerId: null,
    });
    expect(emitted[0]?.room).toBe(channelRoom(ENGLISH));
  });

  it('uses the current replacement snapshot for a stale pause invalidation', async () => {
    const { io, emitted } = fakeIo();
    const reconnecting = { eventId: EVENT, channelId: ENGLISH, slug: 'english', sessionId: STUDIO };
    await goLive({ ...reconnecting, socketId: 'speaker-a' });
    // The same studio on a fresh socket: a reconnect, which is the only way one producer
    // still replaces another now that a colleague's arrival negotiates instead.
    await goLive({ ...reconnecting, socketId: 'speaker-a-again' });

    applyNotification(io, db, {
      type: 'producer-paused',
      eventId: EVENT,
      channelId: ENGLISH,
      slug: 'english',
    });

    expect(emitted[0]?.payload).toMatchObject({ slug: 'english', online: true, muted: false });
    expect(emitted[0]?.room).toBe(channelRoom(ENGLISH));
  });
});

describe('applyNotification peer eviction', () => {
  it('disconnects that socket and no other', () => {
    const { io, disconnectedSockets, addSocket } = fakeIo();
    addSocket('speaker-a');
    addSocket('speaker-b');

    applyNotification(io, db, {
      type: 'peer-evicted',
      socketId: 'speaker-a',
      reason: 'access_revoked',
    });

    expect(disconnectedSockets).toEqual(['speaker-a']);
  });

  it('is a no-op for a socket that has already gone', () => {
    const { io, disconnectedSockets } = fakeIo();

    expect(() =>
      applyNotification(io, db, {
        type: 'peer-evicted',
        socketId: 'long-gone',
        reason: 'access_revoked',
      }),
    ).not.toThrow();
    expect(disconnectedSockets).toEqual([]);
  });
});

describe('applyNotification room eviction', () => {
  it('disconnects the whole event room when access is revoked', () => {
    const { io, disconnectedRooms, emitted } = fakeIo();

    applyNotification(io, db, { type: 'room-evicted', eventId: EVENT, reason: 'access_revoked' });

    expect(disconnectedRooms).toEqual([eventRoom(EVENT)]);
    expect(emitted).toEqual([]);
  });

  it('touches only that event’s room', () => {
    const { io, disconnectedRooms } = fakeIo();

    applyNotification(io, db, { type: 'room-evicted', eventId: 7, reason: 'access_revoked' });

    expect(disconnectedRooms).toEqual([eventRoom(7)]);
    expect(disconnectedRooms).not.toContain(eventRoom(EVENT));
  });

  /**
   * A dead worker takes the media and nothing else — the PIN is still valid and the claim
   * still held — so disconnecting would cost a handshake for no reason.
   */
  it('resets rather than disconnects when a worker died', () => {
    const { io, disconnectedRooms, emitted } = fakeIo();

    applyNotification(io, db, { type: 'room-evicted', eventId: EVENT, reason: 'worker_died' });

    expect(disconnectedRooms).toEqual([]);
    expect(emitted).toEqual([
      { room: eventRoom(EVENT), event: 'media:reset', payload: { reason: 'worker_died' } },
    ]);
  });
});

describe('applyNotification listener counts', () => {
  /**
   * Every listening guest is in the channel room, so a room-scoped emit would hand n
   * guests a number meant for the one speaker. The claim holder is addressed directly.
   */
  it('emits to the claim holder’s socket and to no room at all', () => {
    const { io, emitted } = fakeIo();
    presence.take({ eventId: EVENT, channelId: ENGLISH, sessionId: STUDIO, socketId: 'speaker-a' });

    applyNotification(io, db, {
      type: 'listeners-changed',
      eventId: EVENT,
      channelId: ENGLISH,
      slug: 'english',
      count: 3,
    });

    expect(emitted).toEqual([
      { room: 'speaker-a', event: 'channel:listeners', payload: { slug: 'english', count: 3 } },
    ]);
    expect(emitted.map((e) => e.room)).not.toContain(channelRoom(ENGLISH));
    expect(emitted.map((e) => e.room)).not.toContain(eventRoom(EVENT));
  });

  it('passes the slug and count through unchanged', () => {
    const { io, emitted } = fakeIo();
    presence.take({ eventId: EVENT, channelId: ENGLISH, sessionId: STUDIO, socketId: 'speaker-a' });

    applyNotification(io, db, {
      type: 'listeners-changed',
      eventId: EVENT,
      channelId: ENGLISH,
      slug: 'deutsch',
      count: 0,
    });

    expect(emitted[0]?.payload).toEqual({ slug: 'deutsch', count: 0 });
  });

  it('emits nothing for a channel nobody is speaking on', () => {
    const { io, emitted } = fakeIo();

    expect(() =>
      applyNotification(io, db, {
        type: 'listeners-changed',
        eventId: EVENT,
        channelId: ENGLISH,
        slug: 'english',
        count: 2,
      }),
    ).not.toThrow();
    expect(emitted).toEqual([]);
  });

  it('leaves the producer lifecycle emit untouched', async () => {
    const { io, emitted } = fakeIo();
    presence.take({ eventId: EVENT, channelId: ENGLISH, sessionId: STUDIO, socketId: 'speaker-a' });
    await goLive({
      eventId: EVENT,
      socketId: 'speaker-a',
      channelId: ENGLISH,
      slug: 'english',
      sessionId: STUDIO,
    });

    applyNotification(io, db, {
      type: 'producer-opened',
      eventId: EVENT,
      channelId: ENGLISH,
      slug: 'english',
    });

    expect(emitted).toMatchObject([
      {
        room: eventRoom(EVENT),
        event: 'channel:status',
        payload: { slug: 'english', online: true, muted: false },
      },
    ]);
  });
});

describe('applyNotification claim changes', () => {
  let eventId: number;
  let channelId: number;

  beforeEach(() => {
    const event = createEvent(db, { name: 'A', enabled: true });
    eventId = event.id;
    channelId = createChannel(db, eventId, {
      slug: 'english',
      name: 'English',
      enabled: true,
    }).id;
  });

  afterEach(() => {
    presence.release('speaker-a');
    presence.release('speaker-a2');
    presence.release('speaker-b');
  });

  /** A studio's audience is its claim's, so both seeds ride the claim rather than connect. */
  it('seeds the count and the tally to the socket that took the claim', () => {
    const { io, emitted } = fakeIo();
    presence.registerStudio({ eventId, channelId, sessionId: STUDIO, socketId: 'speaker-a' });

    applyNotification(io, db, {
      type: 'claim-changed',
      eventId,
      channelId,
      sessionId: STUDIO,
      socketId: 'speaker-a',
    });

    expect(emitted.filter((entry) => entry.event === 'channel:listeners')).toEqual([
      { room: 'speaker-a', event: 'channel:listeners', payload: { slug: 'english', count: 0 } },
    ]);
    expect(emitted.filter((entry) => entry.event === 'channel:reports')).toMatchObject([
      { room: 'speaker-a', payload: { slug: 'english', rows: [], soundsGood: null } },
    ]);
  });

  /**
   * The rebind a reconnecting holder triggers is published from inside the handshake,
   * before Socket.IO can address the socket, so the connect path seeds it directly.
   */
  it('seeds a studio that already holds the claim at connection time', () => {
    const { io, emitted } = fakeIo();

    seedClaimAudience(db, io, eventId, channelId, 'speaker-a');

    expect(emitted.map((entry) => entry.event)).toEqual(['channel:listeners', 'channel:reports']);
    expect(emitted.every((entry) => entry.room === 'speaker-a')).toBe(true);
  });

  /** The history rides the claim exactly as the count and the tally do. */
  it('seeds the listener history to the socket that took the claim, and to no room', () => {
    const { io, emitted } = fakeIo();
    presence.take({ eventId, channelId, sessionId: STUDIO, socketId: 'speaker-a' });
    listenerHistory.record(eventId, channelId, 2);

    applyNotification(io, db, {
      type: 'claim-changed',
      eventId,
      channelId,
      sessionId: STUDIO,
      socketId: 'speaker-a',
    });

    const history = emitted.filter((entry) => entry.event === 'channel:listener-history');
    expect(history).toHaveLength(1);
    expect(history[0]?.room).toBe('speaker-a');
    expect(history[0]?.payload).toMatchObject({ slug: 'english' });
    expect(historyCounts(history[0]?.payload)).toEqual([0, 2, 0]);
    expect(emitted.map((entry) => entry.room)).not.toContain(channelRoom(channelId));
  });

  /** A colleague taking over inherits the audience the channel has had all along. */
  it('seeds the incoming studio with the points recorded before the swap', () => {
    const { io, emitted } = fakeIo();
    presence.take({ eventId, channelId, sessionId: STUDIO, socketId: 'speaker-a' });
    listenerHistory.record(eventId, channelId, 4);
    const colleague = { eventId, channelId, sessionId: 'studio-b', socketId: 'speaker-b' };
    presence.registerStudio(colleague);
    expect(handover.request(colleague)).toBe('accepted');
    handover.confirm({ eventId, channelId, sessionId: STUDIO, socketId: 'speaker-a' }, null);
    handover.produced(colleague);
    handover.complete(channelId);
    expect(presence.holder(channelId)).toBe('speaker-b');

    applyNotification(io, db, {
      type: 'claim-changed',
      eventId,
      channelId,
      sessionId: 'studio-b',
      socketId: 'speaker-b',
    });

    const history = emitted.find((entry) => entry.event === 'channel:listener-history');
    expect(history?.room).toBe('speaker-b');
    expect(historyCounts(history?.payload)).toEqual([0, 4, 0]);
    handover.forgetChannel(channelId);
  });

  /**
   * The case the claim's span exists for: the live interpreter's socket drops while a
   * colleague waits, so the claim is gone for the moment between the drop and the completed
   * handover. The restored claim carries the same start, so the incoming studio inherits the
   * series instead of a chart that opens flat at zero.
   */
  it('keeps the history when the holder drops and a waiting colleague completes the handover', () => {
    const { io, emitted } = fakeIo();
    const speaker: SocketAuth = {
      eventId,
      pin: '111111',
      speakerChannelId: channelId,
      studioSession: STUDIO,
    };
    // A moving clock, or a claim restored a millisecond later would look unchanged and the
    // series would ride a reseed nobody would notice.
    const clock = { now: Date.now() };
    vi.spyOn(Date, 'now').mockImplementation(() => clock.now);
    presence.take({ eventId, channelId, sessionId: STUDIO, socketId: 'speaker-a' });
    clock.now += 60_000;
    listenerHistory.record(eventId, channelId, 6);
    const colleague = { eventId, channelId, sessionId: 'studio-b', socketId: 'speaker-b' };
    presence.registerStudio(colleague);
    expect(handover.request(colleague)).toBe('accepted');

    clock.now += 60_000;
    releaseSocket({ id: 'speaker-a' }, speaker);
    expect(presence.holder(channelId)).toBeUndefined();
    // Recorded while nobody holds the claim: the audience is still there, so the series is.
    listenerHistory.record(eventId, channelId, 5);
    clock.now += 60_000;
    handover.produced(colleague);
    expect(handover.complete(channelId)).toBe(true);

    applyNotification(io, db, {
      type: 'claim-changed',
      eventId,
      channelId,
      sessionId: 'studio-b',
      socketId: 'speaker-b',
    });

    const history = emitted.find((entry) => entry.event === 'channel:listener-history');
    expect(history?.room).toBe('speaker-b');
    expect(historyCounts(history?.payload)).toEqual([0, 6, 5, 0]);
    handover.forgetChannel(channelId);
  });

  /**
   * A reconnect is the same broadcast on a new socket, and the dying socket's disconnect
   * lands after the new handshake. Neither may cost the studio its chart.
   */
  it('keeps the history across a reconnect whose stale disconnect arrives late', () => {
    const { io, emitted } = fakeIo();
    presence.take({ eventId, channelId, sessionId: STUDIO, socketId: 'speaker-a' });
    listenerHistory.record(eventId, channelId, 3);

    presence.registerStudio({ eventId, channelId, sessionId: STUDIO, socketId: 'speaker-a2' });
    presence.release('speaker-a');

    seedClaimAudience(db, io, eventId, channelId, 'speaker-a2');

    const history = emitted.find((entry) => entry.event === 'channel:listener-history');
    expect(historyCounts(history?.payload)).toEqual([0, 3, 0]);
  });

  /** One try each: a history that cannot be built must not cost the studio its numbers. */
  it('still seeds the count and the tally when the history throws', () => {
    const { io, emitted } = fakeIo();
    presence.take({ eventId, channelId, sessionId: STUDIO, socketId: 'speaker-a' });
    vi.spyOn(listenerHistory, 'snapshot').mockImplementation(() => {
      throw new Error('nope');
    });

    seedClaimAudience(db, io, eventId, channelId, 'speaker-a');

    expect(emitted.map((entry) => entry.event)).toEqual(['channel:listeners', 'channel:reports']);
    expect(console.error).toHaveBeenCalled();
  });

  it('seeds nobody when the claim was dropped, and still tells every studio', () => {
    const { io, emitted } = fakeIo();
    presence.registerStudio({ eventId, channelId, sessionId: STUDIO, socketId: 'speaker-a' });

    applyNotification(io, db, {
      type: 'claim-changed',
      eventId,
      channelId,
      sessionId: null,
      socketId: null,
    });

    expect(emitted.map((entry) => entry.event)).toEqual(['handover:state']);
    expect(emitted[0]?.room).toBe('speaker-a');
  });

  it('tells every studio on the channel about a handover change', () => {
    const { io, emitted } = fakeIo();
    presence.registerStudio({ eventId, channelId, sessionId: STUDIO, socketId: 'speaker-a' });
    presence.registerStudio({ eventId, channelId, sessionId: 'studio-b', socketId: 'speaker-b' });

    applyNotification(io, db, { type: 'handover-changed', eventId, channelId });

    expect(emitted.map((entry) => entry.room)).toEqual(['speaker-a', 'speaker-b']);
    expect(emitted.every((entry) => entry.event === 'handover:state')).toBe(true);
  });
});

describe('sendInitialListenerCount', () => {
  let eventId: number;
  let channelId: number;

  afterEach(() => {
    presence.releaseChannel(channelId);
    presence.release('speaker-a');
  });

  beforeEach(() => {
    const event = createEvent(db, { name: 'A', enabled: true });
    eventId = event.id;
    channelId = createChannel(db, eventId, {
      slug: 'english',
      name: 'English',
      enabled: true,
    }).id;
  });

  function fakeSpeakerSocket() {
    const emitted: Array<{ event: string; payload: unknown }> = [];
    return {
      emitted,
      socket: {
        emit: (event: string, payload: unknown) => {
          emitted.push({ event, payload });
        },
      },
    };
  }

  it('sends the count a channel already has when the studio connects', async () => {
    await goLive({ eventId, socketId: 'speaker-a', channelId, slug: 'english' });
    const ctx = { eventId, socketId: 'guest-a' };
    await createTransport(ctx, 'recv', { create: false });
    const { consumerId } = await consume(ctx, {
      channelId,
      // biome-ignore lint/suspicious/noExplicitAny: the fakes stand in for mediasoup's types.
      rtpCapabilities: {} as any,
    });
    await resumeConsumer(ctx, consumerId);

    const { socket, emitted } = fakeSpeakerSocket();
    sendInitialListenerCount(db, socket, eventId, channelId);

    expect(emitted).toEqual([
      { event: 'channel:listeners', payload: { slug: 'english', count: 1 } },
    ]);
  });

  // A blank is not a number: the studio must be able to render zero.
  it('sends zero rather than nothing when nobody is listening', () => {
    const { socket, emitted } = fakeSpeakerSocket();

    sendInitialListenerCount(db, socket, eventId, channelId);

    expect(emitted).toEqual([
      { event: 'channel:listeners', payload: { slug: 'english', count: 0 } },
    ]);
  });
});

describe('sendInitialListenerHistory', () => {
  let eventId: number;
  let channelId: number;

  beforeEach(() => {
    const event = createEvent(db, { name: 'A', enabled: true });
    eventId = event.id;
    channelId = createChannel(db, eventId, {
      slug: 'english',
      name: 'English',
      enabled: true,
    }).id;
  });

  afterEach(() => {
    presence.releaseChannel(channelId);
    presence.release('speaker-a');
  });

  function fakeSpeakerSocket() {
    const emitted: Array<{ event: string; payload: unknown }> = [];
    return {
      emitted,
      socket: {
        emit: (event: string, payload: unknown) => {
          emitted.push({ event, payload });
        },
      },
    };
  }

  it('ends the series at the live count, so a studio seeded between recounts is not behind', async () => {
    await goLive({
      eventId,
      socketId: 'speaker-a',
      channelId,
      slug: 'english',
      sessionId: STUDIO,
    });
    const ctx = { eventId, socketId: 'guest-a' };
    await createTransport(ctx, 'recv', { create: false });
    const { consumerId } = await consume(ctx, {
      channelId,
      // biome-ignore lint/suspicious/noExplicitAny: the fakes stand in for mediasoup's types.
      rtpCapabilities: {} as any,
    });
    await resumeConsumer(ctx, consumerId);

    const { socket, emitted } = fakeSpeakerSocket();
    sendInitialListenerHistory(db, socket, eventId, channelId);

    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.event).toBe('channel:listener-history');
    expect(emitted[0]?.payload).toMatchObject({ slug: 'english' });
    expect(historyCounts(emitted[0]?.payload)).toEqual([0, 1]);
  });

  // An empty chart would claim an hour of silence the channel never had.
  it('sends nothing at all for a channel with no broadcast to describe', () => {
    const { socket, emitted } = fakeSpeakerSocket();

    sendInitialListenerHistory(db, socket, eventId, channelId);

    expect(emitted).toEqual([]);
  });
});
