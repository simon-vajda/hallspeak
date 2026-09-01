import { clientToServer } from '@linguacast/contract/socket';
import type { Event } from 'socket.io';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SocketAuth } from '../../core/access';
import { createChannel } from '../../core/channels.service';
import { createEvent } from '../../core/events.service';
import { revokeChannel } from '../../core/media';
import { goLive, startFakeMedia } from '../../core/media/testing';
import { notifications } from '../../core/notifications';
import { presence } from '../../core/presence';
import { reports } from '../../core/reports';
import type { Db } from '../../db/client';
import { createTestDb } from '../../db/testing';
import { channelRoom } from '../lib/rooms';
import { validate } from '../lib/validate';
import { applyNotification, type LifecycleServer, releaseSocket } from './lifecycle.handlers';
import { resolveReports, sendInitialReports, submitReport } from './reports.handlers';

function fakeSocket(id: string, rooms: string[] = []) {
  return { id, rooms: new Set(rooms) };
}

function fakeIo() {
  const emitted: Array<{ room: string; event: string; payload: unknown }> = [];
  const io = {
    to: (room: string) => ({
      emit: (event: string, payload: unknown) => {
        emitted.push({ room, event, payload });
      },
    }),
    in: () => ({ disconnectSockets: () => undefined }),
    sockets: { sockets: new Map() },
  } as unknown as LifecycleServer;
  /** `goLive` broadcasts `channel:status` on the same subscription; only the tally matters. */
  const tallies = () => emitted.filter((entry) => entry.event === 'channel:reports');
  return { io, tallies };
}

/** The one subscriber the real server installs, so a record reaches a socket here too. */
function subscribe(io: LifecycleServer) {
  return notifications.subscribe((notification) => applyNotification(io, notification));
}

const SPEAKER = 'speaker-a';
const LISTENER = 'guest-a';

let db: Db;
let cleanup: () => void;
let stopMedia: () => Promise<void>;
let eventId: number;
let englishId: number;
let foreignSlug: string;
let listener: SocketAuth;
let speaker: SocketAuth;

beforeEach(async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  ({ db, cleanup } = createTestDb());
  stopMedia = await startFakeMedia();

  const a = createEvent(db, { name: 'A', enabled: true });
  eventId = a.id;
  englishId = createChannel(db, a.id, { slug: 'english', name: 'English', enabled: true }).id;
  listener = { eventId: a.id, pin: a.pin, speakerChannelId: null };
  speaker = { eventId: a.id, pin: a.pin, speakerChannelId: englishId };

  const b = createEvent(db, { name: 'B', enabled: true });
  foreignSlug = createChannel(db, b.id, { slug: 'klingon', name: 'Klingon', enabled: true }).slug;
});

afterEach(async () => {
  await stopMedia();
  reports.forgetEvent(eventId);
  presence.releaseChannel(englishId);
  cleanup();
  vi.restoreAllMocks();
});

const live = () => goLive({ eventId, socketId: SPEAKER, channelId: englishId, slug: 'english' });

describe('submitReport', () => {
  it('records a report and sends the tally to the claim holder alone', async () => {
    const { io, tallies } = fakeIo();
    const unsubscribe = subscribe(io);
    presence.claim(englishId, 'code-english', SPEAKER);
    await live();

    const result = submitReport(db, fakeSocket(LISTENER, [channelRoom(englishId)]), listener, {
      slug: 'english',
      category: 'quiet',
    });

    expect(result).toEqual({});
    expect(tallies()).toEqual([
      {
        room: SPEAKER,
        event: 'channel:reports',
        payload: {
          slug: 'english',
          rows: [{ category: 'quiet', count: 1, ageMs: expect.any(Number) }],
          soundsGood: null,
        },
      },
    ]);
    unsubscribe();
  });

  it('refuses a socket that never joined the channel room, recording nothing', async () => {
    presence.claim(englishId, 'code-english', SPEAKER);
    await live();

    expect(() =>
      submitReport(db, fakeSocket(LISTENER), listener, { slug: 'english', category: 'quiet' }),
    ).toThrow(expect.objectContaining({ code: 'not_found' }));
    expect(reports.tally(eventId, englishId)).toEqual([]);
  });

  it('refuses a slug belonging to another event with the same not_found', async () => {
    await live();

    expect(() =>
      submitReport(db, fakeSocket(LISTENER, [channelRoom(englishId)]), listener, {
        slug: foreignSlug,
        category: 'quiet',
      }),
    ).toThrow(expect.objectContaining({ code: 'not_found' }));
  });

  it('refuses a channel with no producer', () => {
    expect(() =>
      submitReport(db, fakeSocket(LISTENER, [channelRoom(englishId)]), listener, {
        slug: 'english',
        category: 'quiet',
      }),
    ).toThrow(expect.objectContaining({ code: 'channel_offline' }));
  });

  it('refuses a duplicate inside the cooldown and publishes no second tally', async () => {
    const { io, tallies } = fakeIo();
    const unsubscribe = subscribe(io);
    presence.claim(englishId, 'code-english', SPEAKER);
    await live();
    const socket = fakeSocket(LISTENER, [channelRoom(englishId)]);
    const payload = { slug: 'english', category: 'quiet' } as const;

    submitReport(db, socket, listener, payload);

    expect(() => submitReport(db, socket, listener, payload)).toThrow(
      expect.objectContaining({ code: 'too_soon' }),
    );
    expect(tallies()).toHaveLength(1);
    unsubscribe();
  });

  it('is refused by the validation middleware for an unknown category', () => {
    const ack = vi.fn();
    const next = vi.fn();

    validate(clientToServer)(
      ['channel:report', { slug: 'english', category: 'feedback' }, ack] as unknown as Event,
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(ack).toHaveBeenCalledWith({
      ok: false,
      error: { code: 'invalid_payload', message: expect.any(String) },
    });
  });
});

describe('resolveReports', () => {
  it('clears this connection’s reports and sends a positive confirmation', async () => {
    const { io, tallies } = fakeIo();
    const unsubscribe = subscribe(io);
    presence.claim(englishId, 'code-english', SPEAKER);
    await live();
    const socket = fakeSocket(LISTENER, [channelRoom(englishId)]);
    submitReport(db, socket, listener, { slug: 'english', category: 'quiet' });
    submitReport(db, socket, listener, { slug: 'english', category: 'noise' });

    expect(resolveReports(db, socket, listener, { slug: 'english' })).toEqual({});
    expect(tallies().at(-1)).toEqual({
      room: SPEAKER,
      event: 'channel:reports',
      payload: {
        slug: 'english',
        rows: [],
        soundsGood: { count: 1, ageMs: expect.any(Number) },
      },
    });
    unsubscribe();
  });

  it('refuses a connection with no open reporting episode', async () => {
    await live();

    expect(() =>
      resolveReports(db, fakeSocket(LISTENER, [channelRoom(englishId)]), listener, {
        slug: 'english',
      }),
    ).toThrow(expect.objectContaining({ code: 'no_open_report' }));
  });

  it('refuses a connection outside the channel room', async () => {
    await live();

    expect(() => resolveReports(db, fakeSocket(LISTENER), listener, { slug: 'english' })).toThrow(
      expect.objectContaining({ code: 'not_found' }),
    );
  });

  it('refuses a resolution after the channel goes offline', async () => {
    const socket = fakeSocket(LISTENER, [channelRoom(englishId)]);

    expect(() => resolveReports(db, socket, listener, { slug: 'english' })).toThrow(
      expect.objectContaining({ code: 'channel_offline' }),
    );
  });
});

describe('reports-changed with no claim holder', () => {
  it('emits to nobody and does not throw', async () => {
    const { io, tallies } = fakeIo();
    const unsubscribe = subscribe(io);
    await live();

    expect(() =>
      submitReport(db, fakeSocket(LISTENER, [channelRoom(englishId)]), listener, {
        slug: 'english',
        category: 'quiet',
      }),
    ).not.toThrow();
    expect(tallies()).toEqual([]);
    unsubscribe();
  });
});

describe('sendInitialReports', () => {
  it('sends the current rows to a studio connecting to a channel with live reports', async () => {
    const emitted: unknown[] = [];
    presence.claim(englishId, 'code-english', SPEAKER);
    await live();
    submitReport(db, fakeSocket(LISTENER, [channelRoom(englishId)]), listener, {
      slug: 'english',
      category: 'silent',
    });

    sendInitialReports(db, { emit: (_event, payload) => emitted.push(payload) }, speaker);

    expect(emitted).toEqual([
      {
        slug: 'english',
        rows: [{ category: 'silent', count: 1, ageMs: expect.any(Number) }],
        soundsGood: null,
      },
    ]);
  });

  it('sends an empty tally rather than nothing, so an unheard window is distinguishable', () => {
    const emitted: unknown[] = [];

    sendInitialReports(db, { emit: (_event, payload) => emitted.push(payload) }, speaker);

    expect(emitted).toEqual([{ slug: 'english', rows: [], soundsGood: null }]);
  });

  it('includes recent positive confirmations in the connect-time snapshot', async () => {
    const emitted: unknown[] = [];
    await live();
    const socket = fakeSocket(LISTENER, [channelRoom(englishId)]);
    submitReport(db, socket, listener, { slug: 'english', category: 'quiet' });
    resolveReports(db, socket, listener, { slug: 'english' });

    sendInitialReports(db, { emit: (_event, payload) => emitted.push(payload) }, speaker);

    expect(emitted).toEqual([
      {
        slug: 'english',
        rows: [],
        soundsGood: { count: 1, ageMs: expect.any(Number) },
      },
    ]);
  });

  it('sends nothing for a socket holding no claim', () => {
    const emitted: unknown[] = [];

    sendInitialReports(db, { emit: (_event, payload) => emitted.push(payload) }, listener);

    expect(emitted).toEqual([]);
  });
});

describe('teardown', () => {
  it('lifts a disconnected socket’s cooldown while keeping its report counted', async () => {
    await live();
    const socket = fakeSocket(LISTENER, [channelRoom(englishId)]);
    submitReport(db, socket, listener, { slug: 'english', category: 'quiet' });

    releaseSocket(socket, listener);

    expect(reports.tally(eventId, englishId)).toEqual([
      { category: 'quiet', count: 1, ageMs: expect.any(Number) },
    ]);
    expect(() =>
      submitReport(db, fakeSocket(LISTENER, [channelRoom(englishId)]), listener, {
        slug: 'english',
        category: 'quiet',
      }),
    ).not.toThrow();
  });

  it('drops the channel’s tally when the channel is revoked', async () => {
    presence.claim(englishId, 'code-english', SPEAKER);
    await live();
    submitReport(db, fakeSocket(LISTENER, [channelRoom(englishId)]), listener, {
      slug: 'english',
      category: 'quiet',
    });

    revokeChannel(eventId, englishId, 'access_revoked');

    expect(reports.tally(eventId, englishId)).toEqual([]);
  });
});
