import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SocketAuth } from '../../core/access';
import { createChannel } from '../../core/channels.service';
import { createEvent } from '../../core/events.service';
import { pauseProducer } from '../../core/media';
import { goLive, startFakeMedia } from '../../core/media/testing';
import { PresenceRegistry } from '../../core/presence';
import type { Db } from '../../db/client';
import { createTestDb } from '../../db/testing';
import { channelRoom } from '../lib/rooms';
import { joinChannel, leaveChannel } from './channels.handlers';

function fakeSocket() {
  const rooms = new Set<string>();
  return {
    rooms,
    join: (room: string) => void rooms.add(room),
    leave: (room: string) => void rooms.delete(room),
  };
}

let db: Db;
let cleanup: () => void;
let presence: PresenceRegistry;
let authA: SocketAuth;
let englishId: number;
let foreignSlug: string;

beforeEach(() => {
  ({ db, cleanup } = createTestDb());
  presence = new PresenceRegistry();

  const a = createEvent(db, { name: 'A', enabled: true });
  englishId = createChannel(db, a.id, { slug: 'english', name: 'English', enabled: true }).id;
  createChannel(db, a.id, { slug: 'german', name: 'German' });
  authA = { eventId: a.id, pin: a.pin, speakerChannelId: null, studioSession: null };

  const b = createEvent(db, { name: 'B', enabled: true });
  foreignSlug = createChannel(db, b.id, { slug: 'klingon', name: 'Klingon', enabled: true }).slug;
});

afterEach(() => {
  cleanup();
});

describe('joinChannel', () => {
  it('puts the socket in the channel room and reports liveness', () => {
    const socket = fakeSocket();

    expect(joinChannel(db, socket, authA, 'english')).toEqual({
      online: false,
      muted: false,
      producerId: null,
      incomingProducerId: null,
    });
    expect(socket.rooms.has(channelRoom(englishId))).toBe(true);
  });

  // Liveness is producer existence, not the claim: an open studio is not audio.
  it('reports offline when a speaker only holds the claim', () => {
    presence.take({
      eventId: authA.eventId,
      channelId: englishId,
      sessionId: 'studio-x',
      socketId: 'speaker-socket',
    });
    const socket = fakeSocket();

    expect(joinChannel(db, socket, authA, 'english')).toEqual({
      online: false,
      muted: false,
      producerId: null,
      incomingProducerId: null,
    });
  });

  it('reports online once a producer exists on the channel', async () => {
    const stopMedia = await startFakeMedia();
    try {
      await goLive({
        eventId: authA.eventId,
        socketId: 'speaker-socket',
        channelId: englishId,
        slug: 'english',
      });

      expect(joinChannel(db, fakeSocket(), authA, 'english')).toMatchObject({
        online: true,
        muted: false,
      });
    } finally {
      await stopMedia();
    }
  });

  it('reports a paused producer as online and muted', async () => {
    const stopMedia = await startFakeMedia();
    try {
      const { producerId } = await goLive({
        eventId: authA.eventId,
        socketId: 'speaker-socket',
        channelId: englishId,
        slug: 'english',
      });
      await pauseProducer(
        { eventId: authA.eventId, socketId: 'speaker-socket' },
        englishId,
        producerId,
      );

      expect(joinChannel(db, fakeSocket(), authA, 'english')).toMatchObject({
        online: true,
        muted: true,
      });
    } finally {
      await stopMedia();
    }
  });

  // The slug resolves against the socket's own event, so a foreign channel does not exist.
  it('refuses a channel belonging to another event', () => {
    const socket = fakeSocket();

    expect(() => joinChannel(db, socket, authA, foreignSlug)).toThrow(/not_found|No channel/);
    expect(socket.rooms.size).toBe(0);
  });

  it('refuses a disabled channel', () => {
    const socket = fakeSocket();

    expect(() => joinChannel(db, socket, authA, 'german')).toThrow();
    expect(socket.rooms.size).toBe(0);
  });

  it('refuses an unknown slug', () => {
    const socket = fakeSocket();

    expect(() => joinChannel(db, socket, authA, 'nonexistent')).toThrow();
  });
});

describe('leaveChannel', () => {
  it('removes the socket from the channel room', () => {
    const socket = fakeSocket();
    joinChannel(db, socket, authA, 'english');

    leaveChannel(db, socket, authA, 'english');

    expect(socket.rooms.has(channelRoom(englishId))).toBe(false);
  });

  it('is a no-op for a slug the socket cannot address', () => {
    const socket = fakeSocket();
    joinChannel(db, socket, authA, 'english');

    expect(() => leaveChannel(db, socket, authA, foreignSlug)).not.toThrow();
    expect(socket.rooms.has(channelRoom(englishId))).toBe(true);
  });
});
