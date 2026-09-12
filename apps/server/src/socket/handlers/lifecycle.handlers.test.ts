import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SocketAuth } from '../../core/access';
import { createChannel } from '../../core/channels.service';
import { createEvent } from '../../core/events.service';
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
  sendInitialListenerCount,
} from './lifecycle.handlers';

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

beforeEach(async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  stopMedia = await startFakeMedia();
});

afterEach(async () => {
  await stopMedia();
  presence.releaseChannel(ENGLISH);
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

    applyNotification(io, {
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

    applyNotification(io, {
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
    applyNotification(io, {
      type: 'producer-paused',
      eventId: EVENT,
      channelId: ENGLISH,
      slug: 'english',
    });
    await resumeProducer(ctx, ENGLISH, producerId);
    applyNotification(io, {
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

    applyNotification(io, {
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

    applyNotification(io, {
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

    applyNotification(io, {
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

    applyNotification(io, {
      type: 'peer-evicted',
      socketId: 'speaker-a',
      reason: 'access_revoked',
    });

    expect(disconnectedSockets).toEqual(['speaker-a']);
  });

  it('is a no-op for a socket that has already gone', () => {
    const { io, disconnectedSockets } = fakeIo();

    expect(() =>
      applyNotification(io, {
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

    applyNotification(io, { type: 'room-evicted', eventId: EVENT, reason: 'access_revoked' });

    expect(disconnectedRooms).toEqual([eventRoom(EVENT)]);
    expect(emitted).toEqual([]);
  });

  it('touches only that event’s room', () => {
    const { io, disconnectedRooms } = fakeIo();

    applyNotification(io, { type: 'room-evicted', eventId: 7, reason: 'access_revoked' });

    expect(disconnectedRooms).toEqual([eventRoom(7)]);
    expect(disconnectedRooms).not.toContain(eventRoom(EVENT));
  });

  /**
   * A dead worker takes the media and nothing else — the PIN is still valid and the claim
   * still held — so disconnecting would cost a handshake for no reason.
   */
  it('resets rather than disconnects when a worker died', () => {
    const { io, disconnectedRooms, emitted } = fakeIo();

    applyNotification(io, { type: 'room-evicted', eventId: EVENT, reason: 'worker_died' });

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

    applyNotification(io, {
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

    applyNotification(io, {
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
      applyNotification(io, {
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

    applyNotification(io, {
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

describe('sendInitialListenerCount', () => {
  let db: Db;
  let cleanup: () => void;
  let eventId: number;
  let channelId: number;

  beforeEach(() => {
    ({ db, cleanup } = createTestDb());
    const event = createEvent(db, { name: 'A', enabled: true });
    eventId = event.id;
    channelId = createChannel(db, eventId, {
      slug: 'english',
      name: 'English',
      enabled: true,
    }).id;
  });

  afterEach(() => {
    cleanup();
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
    sendInitialListenerCount(db, socket, {
      eventId,
      pin: '111111',
      speakerChannelId: channelId,
      studioSession: STUDIO,
    });

    expect(emitted).toEqual([
      { event: 'channel:listeners', payload: { slug: 'english', count: 1 } },
    ]);
  });

  // A blank is not a number: the studio must be able to render zero.
  it('sends zero rather than nothing when nobody is listening', () => {
    const { socket, emitted } = fakeSpeakerSocket();

    sendInitialListenerCount(db, socket, {
      eventId,
      pin: '111111',
      speakerChannelId: channelId,
      studioSession: STUDIO,
    });

    expect(emitted).toEqual([
      { event: 'channel:listeners', payload: { slug: 'english', count: 0 } },
    ]);
  });
});
