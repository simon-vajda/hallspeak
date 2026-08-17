import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SocketAuth } from '../../core/access';
import { createChannel } from '../../core/channels.service';
import { createEvent } from '../../core/events.service';
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
  authA = { eventId: a.id, pin: a.pin, speakerChannelId: null };

  const b = createEvent(db, { name: 'B', enabled: true });
  foreignSlug = createChannel(db, b.id, { slug: 'klingon', name: 'Klingon', enabled: true }).slug;
});

afterEach(() => {
  cleanup();
});

describe('joinChannel', () => {
  it('puts the socket in the channel room and reports liveness', () => {
    const socket = fakeSocket();

    expect(joinChannel(db, presence, socket, authA, 'english')).toEqual({ online: false });
    expect(socket.rooms.has(channelRoom(englishId))).toBe(true);
  });

  it('reports online when a speaker holds the channel', () => {
    presence.claim(englishId, 'code-x', 'speaker-socket');
    const socket = fakeSocket();

    expect(joinChannel(db, presence, socket, authA, 'english')).toEqual({ online: true });
  });

  // The slug resolves against the socket's own event, so a foreign channel does not exist.
  it('refuses a channel belonging to another event', () => {
    const socket = fakeSocket();

    expect(() => joinChannel(db, presence, socket, authA, foreignSlug)).toThrow(
      /not_found|No channel/,
    );
    expect(socket.rooms.size).toBe(0);
  });

  it('refuses a disabled channel', () => {
    const socket = fakeSocket();

    expect(() => joinChannel(db, presence, socket, authA, 'german')).toThrow();
    expect(socket.rooms.size).toBe(0);
  });

  it('refuses an unknown slug', () => {
    const socket = fakeSocket();

    expect(() => joinChannel(db, presence, socket, authA, 'nonexistent')).toThrow();
  });
});

describe('leaveChannel', () => {
  it('removes the socket from the channel room', () => {
    const socket = fakeSocket();
    joinChannel(db, presence, socket, authA, 'english');

    leaveChannel(db, socket, authA, 'english');

    expect(socket.rooms.has(channelRoom(englishId))).toBe(false);
  });

  it('is a no-op for a slug the socket cannot address', () => {
    const socket = fakeSocket();
    joinChannel(db, presence, socket, authA, 'english');

    expect(() => leaveChannel(db, socket, authA, foreignSlug)).not.toThrow();
    expect(socket.rooms.has(channelRoom(englishId))).toBe(true);
  });
});
