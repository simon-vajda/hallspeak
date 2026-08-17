import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SocketAuth } from '../../core/access';
import { isOnline } from '../../core/media';
import { goLive, startFakeMedia } from '../../core/media/testing';
import { presence } from '../../core/presence';
import { eventRoom } from '../lib/rooms';
import { applyNotification, type LifecycleServer, releaseSocket } from './lifecycle.handlers';

const EVENT = 1;
const ENGLISH = 10;

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
  const speaker: SocketAuth = { eventId: EVENT, pin: '111111', speakerChannelId: ENGLISH };

  it('closes a live producer and takes the channel offline', async () => {
    presence.claim(ENGLISH, 'code-english', 'speaker-a');
    await goLive({ eventId: EVENT, socketId: 'speaker-a', channelId: ENGLISH, slug: 'english' });

    releaseSocket({ id: 'speaker-a' }, speaker);

    expect(isOnline(EVENT, ENGLISH)).toBe(false);
    expect(presence.holder(ENGLISH)).toBeUndefined();
  });

  it('releases the claim and does nothing else for a session holding no media', () => {
    presence.claim(ENGLISH, 'code-english', 'speaker-a');

    expect(() => releaseSocket({ id: 'speaker-a' }, speaker)).not.toThrow();
    expect(presence.holder(ENGLISH)).toBeUndefined();
  });

  it('is a no-op for a listener that held nothing at all', () => {
    const listener: SocketAuth = { eventId: EVENT, pin: '111111', speakerChannelId: null };

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
  it('broadcasts online to the event room, not the channel room', () => {
    const { io, emitted } = fakeIo();

    applyNotification(io, {
      type: 'producer-opened',
      eventId: EVENT,
      channelId: ENGLISH,
      slug: 'english',
    });

    expect(emitted).toEqual([
      {
        room: eventRoom(EVENT),
        event: 'channel:status',
        payload: { slug: 'english', online: true },
      },
    ]);
  });

  it('broadcasts offline when the producer closes', () => {
    const { io, emitted } = fakeIo();

    applyNotification(io, {
      type: 'producer-closed',
      eventId: EVENT,
      channelId: ENGLISH,
      slug: 'english',
    });

    expect(emitted[0]?.payload).toEqual({ slug: 'english', online: false });
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
      reason: 'claim_taken_over',
    });

    expect(disconnectedSockets).toEqual(['speaker-a']);
  });

  it('is a no-op for a socket that has already gone', () => {
    const { io, disconnectedSockets } = fakeIo();

    expect(() =>
      applyNotification(io, {
        type: 'peer-evicted',
        socketId: 'long-gone',
        reason: 'claim_taken_over',
      }),
    ).not.toThrow();
    expect(disconnectedSockets).toEqual([]);
  });

  it('evicts the displaced socket on a takeover and leaves the new holder connected', () => {
    const { io, disconnectedSockets, addSocket } = fakeIo();
    addSocket('incumbent');
    addSocket('reconnecting');

    applyNotification(io, {
      type: 'peer-evicted',
      socketId: 'incumbent',
      reason: 'claim_taken_over',
    });

    expect(disconnectedSockets).toEqual(['incumbent']);
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
