import type { HandoverState } from '@hallspeak/contract/socket';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SocketAuth } from '../../core/access';
import { createChannel } from '../../core/channels.service';
import { createEvent } from '../../core/events.service';
import { handover, TAKEOVER_AFTER_MS } from '../../core/handover';
import { closeProducer } from '../../core/media';
import { goLive, startFakeMedia } from '../../core/media/testing';
import { notifications } from '../../core/notifications';
import { presence, type StudioSocket } from '../../core/presence';
import type { Db } from '../../db/client';
import { createTestDb } from '../../db/testing';
import {
  cancelHandover,
  confirmHandover,
  requestHandover,
  sendHandoverState,
  takeOverHandover,
} from './handover.handlers';
import { applyNotification, type LifecycleServer, releaseSocket } from './lifecycle.handlers';

const SOCKET_A = 'speaker-a';
const SOCKET_B = 'speaker-b';
const SOCKET_C = 'speaker-c';
const STUDIO_A = 'studio-a';
const STUDIO_B = 'studio-b';
const STUDIO_C = 'studio-c';

interface Emission {
  room: string;
  event: string;
  payload: unknown;
}

function fakeIo() {
  const emitted: Emission[] = [];
  const disconnected: string[] = [];
  const sockets = new Map<string, { disconnect(close: boolean): void }>();

  const io: LifecycleServer = {
    to: (room: string) => ({
      emit: (event: string, payload: unknown) => {
        emitted.push({ room, event, payload });
      },
    }),
    in: () => ({ disconnectSockets: () => undefined }),
    sockets: { sockets },
  } as unknown as LifecycleServer;

  const addSocket = (id: string) => {
    sockets.set(id, {
      disconnect: () => {
        disconnected.push(id);
      },
    });
  };

  return { io, emitted, disconnected, addSocket };
}

let db: Db;
let closeDb: () => void;
let stopMedia: () => Promise<void>;
let unsubscribe: () => void;
let eventId: number;
let channelId: number;
let io: LifecycleServer;
let emitted: Emission[];
let disconnected: string[];

beforeEach(async () => {
  stopMedia = await startFakeMedia();
  ({ db, cleanup: closeDb } = createTestDb());

  const event = createEvent(db, { name: 'Sunday', enabled: true });
  eventId = event.id;
  channelId = createChannel(db, eventId, { slug: 'english', name: 'English', enabled: true }).id;

  ({ io, emitted, disconnected } = fakeIo());
  // The one subscriber the real server installs, so a change reaches a socket here too.
  unsubscribe = notifications.subscribe((n) => applyNotification(io, db, n));
});

afterEach(async () => {
  unsubscribe();
  await stopMedia();
  // Claims and handovers are process singletons; leaving either behind leaks into the next test.
  handover.forgetChannel(channelId);
  presence.releaseChannel(channelId);
  for (const socketId of [SOCKET_A, SOCKET_B, SOCKET_C]) {
    presence.release(socketId);
  }
  closeDb();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const studioOf = (socketId: string, sessionId: string): StudioSocket => ({
  eventId,
  channelId,
  sessionId,
  socketId,
});

const authOf = (sessionId: string): SocketAuth => ({
  eventId,
  pin: '111111',
  speakerChannelId: channelId,
  studioSession: sessionId,
});

/** What `socket/index.ts` does for a studio socket at connection time. */
function connectStudio(socketId: string, sessionId: string): StudioSocket {
  const studio = studioOf(socketId, sessionId);
  presence.registerStudio(studio);
  sendHandoverState(db, io.to(socketId), studio);
  return studio;
}

const snapshotsFor = (socketId: string): HandoverState[] =>
  emitted
    .filter((entry) => entry.room === socketId && entry.event === 'handover:state')
    .map((entry) => entry.payload as HandoverState);

const latestFor = (socketId: string): HandoverState | undefined => snapshotsFor(socketId).at(-1);

const eventsFor = (socketId: string, event: string) =>
  emitted.filter((entry) => entry.room === socketId && entry.event === event);

const liveOn = (socketId: string, sessionId: string) =>
  goLive({ eventId, socketId, channelId, slug: 'english', sessionId });

describe('the connect-time snapshot', () => {
  it('tells a studio joining a live channel that another studio holds it', async () => {
    connectStudio(SOCKET_A, STUDIO_A);
    await liveOn(SOCKET_A, STUDIO_A);
    const beforeB = snapshotsFor(SOCKET_A).length;

    connectStudio(SOCKET_B, STUDIO_B);

    expect(latestFor(SOCKET_B)).toMatchObject({
      slug: 'english',
      holder: 'other',
      role: 'bystander',
      pending: false,
      remainingMs: null,
      canTakeOver: false,
    });
    // The interpreter on air learns nothing from a colleague merely opening a page.
    expect(snapshotsFor(SOCKET_A)).toHaveLength(beforeB);
    expect(disconnected).toEqual([]);
  });

  it('tells a studio on a free channel that nobody holds it, and seeds no audience', () => {
    connectStudio(SOCKET_A, STUDIO_A);

    expect(latestFor(SOCKET_A)).toMatchObject({
      holder: 'none',
      role: 'bystander',
      pending: false,
      canTakeOver: false,
    });
    // A studio holding no claim has no audience and no tally of its own.
    expect(eventsFor(SOCKET_A, 'channel:listeners')).toEqual([]);
    expect(eventsFor(SOCKET_A, 'channel:reports')).toEqual([]);
  });

  it('reports the studio’s own claim as its own', async () => {
    connectStudio(SOCKET_A, STUDIO_A);
    await liveOn(SOCKET_A, STUDIO_A);

    expect(latestFor(SOCKET_A)).toMatchObject({ holder: 'self', role: 'live' });
  });
});

describe('a claim changing', () => {
  it('tells a studio already in pre-flight that a colleague went live', async () => {
    connectStudio(SOCKET_B, STUDIO_B);
    connectStudio(SOCKET_A, STUDIO_A);

    await liveOn(SOCKET_A, STUDIO_A);

    expect(latestFor(SOCKET_B)).toMatchObject({ holder: 'other', role: 'bystander' });
  });

  it('tells every other studio the channel is free again when the broadcast ends', async () => {
    connectStudio(SOCKET_A, STUDIO_A);
    const { producerId } = await liveOn(SOCKET_A, STUDIO_A);
    connectStudio(SOCKET_B, STUDIO_B);

    await closeProducer(
      { eventId, socketId: SOCKET_A, sessionId: STUDIO_A },
      channelId,
      producerId,
    );

    expect(latestFor(SOCKET_B)).toMatchObject({ holder: 'none', role: 'bystander' });
    expect(latestFor(SOCKET_A)).toMatchObject({ holder: 'none', role: 'bystander' });
  });

  it('seeds the listener count and report tally to the studio that took the claim', async () => {
    connectStudio(SOCKET_A, STUDIO_A);

    await liveOn(SOCKET_A, STUDIO_A);

    expect(eventsFor(SOCKET_A, 'channel:listeners')).toMatchObject([
      { payload: { slug: 'english', count: 0 } },
    ]);
    expect(eventsFor(SOCKET_A, 'channel:reports')).toMatchObject([
      { payload: { slug: 'english', rows: [], soundsGood: null } },
    ]);
  });
});

describe('requesting a handover', () => {
  it('is accepted and tells both studios where they stand', async () => {
    connectStudio(SOCKET_A, STUDIO_A);
    await liveOn(SOCKET_A, STUDIO_A);
    connectStudio(SOCKET_B, STUDIO_B);

    expect(requestHandover({ id: SOCKET_B }, authOf(STUDIO_B))).toEqual({});

    expect(latestFor(SOCKET_B)).toMatchObject({
      holder: 'other',
      role: 'waiting',
      pending: true,
      canTakeOver: false,
    });
    expect(latestFor(SOCKET_B)?.remainingMs).toBeGreaterThan(0);
    expect(latestFor(SOCKET_A)).toMatchObject({ holder: 'self', role: 'live', pending: true });
  });

  it('refuses a listener socket, which has no studio at all', () => {
    const listener: SocketAuth = {
      eventId,
      pin: '111111',
      speakerChannelId: null,
      studioSession: null,
    };

    expect(() => requestHandover({ id: 'guest-a' }, listener)).toThrow(
      expect.objectContaining({ code: 'not_speaker' }),
    );
  });

  it('refuses when nobody is broadcasting', () => {
    connectStudio(SOCKET_B, STUDIO_B);

    expect(() => requestHandover({ id: SOCKET_B }, authOf(STUDIO_B))).toThrow(
      expect.objectContaining({ code: 'not_live' }),
    );
  });

  it('refuses the studio that is already live', async () => {
    connectStudio(SOCKET_A, STUDIO_A);
    await liveOn(SOCKET_A, STUDIO_A);

    expect(() => requestHandover({ id: SOCKET_A }, authOf(STUDIO_A))).toThrow(
      expect.objectContaining({ code: 'already_live' }),
    );
  });

  it('refuses a second request while one is under way', async () => {
    connectStudio(SOCKET_A, STUDIO_A);
    await liveOn(SOCKET_A, STUDIO_A);
    connectStudio(SOCKET_B, STUDIO_B);
    connectStudio(SOCKET_C, STUDIO_C);
    requestHandover({ id: SOCKET_B }, authOf(STUDIO_B));

    expect(() => requestHandover({ id: SOCKET_C }, authOf(STUDIO_C))).toThrow(
      expect.objectContaining({ code: 'handover_in_progress' }),
    );
    expect(latestFor(SOCKET_C)).toMatchObject({ role: 'bystander', pending: true });
  });
});

describe('withdrawing a request', () => {
  it('clears both prompts', async () => {
    connectStudio(SOCKET_A, STUDIO_A);
    await liveOn(SOCKET_A, STUDIO_A);
    connectStudio(SOCKET_B, STUDIO_B);
    requestHandover({ id: SOCKET_B }, authOf(STUDIO_B));

    expect(cancelHandover({ id: SOCKET_B }, authOf(STUDIO_B))).toEqual({});

    expect(latestFor(SOCKET_B)).toMatchObject({ role: 'bystander', pending: false });
    expect(latestFor(SOCKET_A)).toMatchObject({ role: 'live', pending: false });
  });

  it('refuses a studio that is not the one waiting', async () => {
    connectStudio(SOCKET_A, STUDIO_A);
    await liveOn(SOCKET_A, STUDIO_A);
    connectStudio(SOCKET_B, STUDIO_B);
    requestHandover({ id: SOCKET_B }, authOf(STUDIO_B));

    expect(() => cancelHandover({ id: SOCKET_A }, authOf(STUDIO_A))).toThrow(
      expect.objectContaining({ code: 'not_waiting' }),
    );
  });
});

describe('confirming a handover', () => {
  it('grants the waiter and leaves both studios connected', async () => {
    connectStudio(SOCKET_A, STUDIO_A);
    await liveOn(SOCKET_A, STUDIO_A);
    connectStudio(SOCKET_B, STUDIO_B);
    requestHandover({ id: SOCKET_B }, authOf(STUDIO_B));

    expect(confirmHandover({ id: SOCKET_A }, authOf(STUDIO_A))).toEqual({});

    expect(latestFor(SOCKET_B)).toMatchObject({ holder: 'other', role: 'granted', pending: true });
    expect(latestFor(SOCKET_A)).toMatchObject({
      holder: 'self',
      role: 'handing-over',
      pending: true,
    });
    expect(disconnected).toEqual([]);
  });

  it('moves the claim only once the incoming interpreter is up', async () => {
    connectStudio(SOCKET_A, STUDIO_A);
    await liveOn(SOCKET_A, STUDIO_A);
    connectStudio(SOCKET_B, STUDIO_B);
    requestHandover({ id: SOCKET_B }, authOf(STUDIO_B));
    confirmHandover({ id: SOCKET_A }, authOf(STUDIO_A));

    await liveOn(SOCKET_B, STUDIO_B);

    expect(latestFor(SOCKET_A)).toMatchObject({
      holder: 'other',
      role: 'bystander',
      pending: false,
    });
    expect(latestFor(SOCKET_B)).toMatchObject({ holder: 'self', role: 'live', pending: false });
    expect(disconnected).toEqual([]);
  });

  it('moves the audience to the new holder and sends the old one nothing further', async () => {
    connectStudio(SOCKET_A, STUDIO_A);
    await liveOn(SOCKET_A, STUDIO_A);
    connectStudio(SOCKET_B, STUDIO_B);
    requestHandover({ id: SOCKET_B }, authOf(STUDIO_B));
    confirmHandover({ id: SOCKET_A }, authOf(STUDIO_A));
    const tailA = emitted.filter((entry) => entry.room === SOCKET_A).length;

    await liveOn(SOCKET_B, STUDIO_B);

    expect(eventsFor(SOCKET_B, 'channel:listeners')).toHaveLength(1);
    expect(eventsFor(SOCKET_B, 'channel:reports')).toHaveLength(1);
    const afterA = emitted.slice(tailA).filter((entry) => entry.room === SOCKET_A);
    expect(afterA.map((entry) => entry.event)).not.toContain('channel:reports');
    expect(afterA.map((entry) => entry.event)).not.toContain('channel:listeners');
  });

  it('refuses a studio that is not the claim holder', async () => {
    connectStudio(SOCKET_A, STUDIO_A);
    await liveOn(SOCKET_A, STUDIO_A);
    connectStudio(SOCKET_B, STUDIO_B);
    requestHandover({ id: SOCKET_B }, authOf(STUDIO_B));

    expect(() => confirmHandover({ id: SOCKET_B }, authOf(STUDIO_B))).toThrow(
      expect.objectContaining({ code: 'not_holder' }),
    );
  });

  it('refuses when nobody is waiting', async () => {
    connectStudio(SOCKET_A, STUDIO_A);
    await liveOn(SOCKET_A, STUDIO_A);

    expect(() => confirmHandover({ id: SOCKET_A }, authOf(STUDIO_A))).toThrow(
      expect.objectContaining({ code: 'nothing_pending' }),
    );
  });
});

describe('forcing a handover', () => {
  it('is refused while the interpreter on air still has time', async () => {
    connectStudio(SOCKET_A, STUDIO_A);
    await liveOn(SOCKET_A, STUDIO_A);
    connectStudio(SOCKET_B, STUDIO_B);
    requestHandover({ id: SOCKET_B }, authOf(STUDIO_B));

    expect(() => takeOverHandover({ id: SOCKET_B }, authOf(STUDIO_B))).toThrow(
      expect.objectContaining({ code: 'too_soon' }),
    );
  });

  it('is refused for a studio that never asked', async () => {
    connectStudio(SOCKET_A, STUDIO_A);
    await liveOn(SOCKET_A, STUDIO_A);
    connectStudio(SOCKET_B, STUDIO_B);

    expect(() => takeOverHandover({ id: SOCKET_B }, authOf(STUDIO_B))).toThrow(
      expect.objectContaining({ code: 'not_waiting' }),
    );
  });

  it('becomes available once the countdown runs out, and grants without the holder', async () => {
    // From the start, so the registry's own deadline timer is one the test can advance.
    vi.useFakeTimers();
    connectStudio(SOCKET_A, STUDIO_A);
    await liveOn(SOCKET_A, STUDIO_A);
    connectStudio(SOCKET_B, STUDIO_B);
    requestHandover({ id: SOCKET_B }, authOf(STUDIO_B));

    vi.advanceTimersByTime(TAKEOVER_AFTER_MS);

    expect(latestFor(SOCKET_B)).toMatchObject({ role: 'waiting', canTakeOver: true });
    expect(latestFor(SOCKET_B)?.remainingMs).toBe(0);
    expect(takeOverHandover({ id: SOCKET_B }, authOf(STUDIO_B))).toEqual({});
    expect(latestFor(SOCKET_B)).toMatchObject({ role: 'granted' });
    expect(latestFor(SOCKET_A)).toMatchObject({ role: 'handing-over' });
  });
});

describe('the live interpreter departing', () => {
  it('grants the waiting studio when the holder’s socket goes', async () => {
    connectStudio(SOCKET_A, STUDIO_A);
    await liveOn(SOCKET_A, STUDIO_A);
    connectStudio(SOCKET_B, STUDIO_B);
    requestHandover({ id: SOCKET_B }, authOf(STUDIO_B));

    releaseSocket({ id: SOCKET_A }, authOf(STUDIO_A));

    expect(latestFor(SOCKET_B)).toMatchObject({ holder: 'none', role: 'granted', pending: true });
  });

  it('grants nothing when the same studio has already reconnected', async () => {
    connectStudio(SOCKET_A, STUDIO_A);
    await liveOn(SOCKET_A, STUDIO_A);
    connectStudio(SOCKET_B, STUDIO_B);
    requestHandover({ id: SOCKET_B }, authOf(STUDIO_B));
    // The same studio on a fresh connection; the claim follows it there.
    connectStudio(SOCKET_C, STUDIO_A);

    releaseSocket({ id: SOCKET_A }, authOf(STUDIO_A));

    expect(handover.view(channelId)?.grant).toBeNull();
    expect(latestFor(SOCKET_B)).toMatchObject({ role: 'waiting', pending: true });
    expect(presence.claimOf(channelId)).toMatchObject({ sessionId: STUDIO_A, socketId: SOCKET_C });
  });
});
