import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SocketAuth } from '../../core/access';
import { createChannel } from '../../core/channels.service';
import { createEvent } from '../../core/events.service';
import { isOnline } from '../../core/media';
import { startFakeMedia } from '../../core/media/testing';
import type { Db } from '../../db/client';
import { createTestDb } from '../../db/testing';
import {
  connectTransport,
  getCapabilities,
  openTransport,
  pauseProducing,
  resumeConsuming,
  resumeProducing,
  startConsuming,
  startProducing,
  stopConsuming,
  stopProducing,
} from './media.handlers';

let db: Db;
let cleanupDb: () => void;
let stopMedia: () => Promise<void>;

let eventId: number;
let englishId: number;
let spanishId: number;
let foreignSlug: string;
let foreignAuth: SocketAuth;

let speaker: SocketAuth;
let listener: SocketAuth;

const socket = (id: string) => ({ id });

beforeEach(async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  ({ db, cleanup: cleanupDb } = createTestDb());
  stopMedia = await startFakeMedia();

  const event = createEvent(db, { name: 'Sunday', enabled: true });
  eventId = event.id;
  englishId = createChannel(db, event.id, { slug: 'english', name: 'English', enabled: true }).id;
  spanishId = createChannel(db, event.id, { slug: 'spanish', name: 'Spanish', enabled: true }).id;

  const other = createEvent(db, { name: 'Conference', enabled: true });
  createChannel(db, other.id, { slug: 'french', name: 'French', enabled: true });
  foreignSlug = 'french';
  foreignAuth = { eventId: other.id, pin: other.pin, speakerChannelId: null };

  speaker = { eventId, pin: event.pin, speakerChannelId: englishId };
  listener = { eventId, pin: event.pin, speakerChannelId: null };
});

afterEach(async () => {
  await stopMedia();
  cleanupDb();
  vi.restoreAllMocks();
});

/** The three calls a speaker makes, through the handlers rather than the facade. */
async function goLive(id = 'speaker-a', auth = speaker, slug = 'english') {
  await openTransport(socket(id), auth, { direction: 'send' });
  return startProducing(db, socket(id), auth, { slug, rtpParameters: { codecs: [] } });
}

async function armListener(id = 'guest-a') {
  await openTransport(socket(id), listener, { direction: 'recv' });
}

describe('getCapabilities', () => {
  it('returns the router capabilities to a speaker, creating the room', async () => {
    const result = await getCapabilities(socket('speaker-a'), speaker);

    expect(result.routerRtpCapabilities.codecs?.[0]?.mimeType).toBe('audio/opus');
  });

  it('returns the configured ICE servers, which are empty without coturn', async () => {
    const result = await getCapabilities(socket('speaker-a'), speaker);

    expect(result.iceServers).toEqual([]);
  });

  it('mints a fresh TURN credential per call rather than echoing the shared secret', async () => {
    await stopMedia();
    stopMedia = await startFakeMedia({
      turn: { turnUrl: 'turn:turn.example.org:3478', turnSecret: 'shared-secret' },
    });

    const first = await getCapabilities(socket('speaker-a'), speaker);
    const second = await getCapabilities(socket('speaker-b'), speaker);

    const [turn] = first.iceServers;
    expect(turn?.urls).toEqual(['turn:turn.example.org:3478']);
    // The username is the credential's expiry, so it is proof of a time limit.
    expect(Number(turn?.username)).toBeGreaterThan(Date.now() / 1000);
    expect(JSON.stringify(first.iceServers)).not.toContain('shared-secret');
    expect(second.iceServers[0]?.credential).toBeDefined();
  });

  it('refuses a listener before anyone is live, rather than creating a room', async () => {
    await expect(getCapabilities(socket('guest-a'), listener)).rejects.toMatchObject({
      code: 'not_live',
    });
  });

  it('serves a listener once a speaker has gone live', async () => {
    await goLive();

    const result = await getCapabilities(socket('guest-a'), listener);

    expect(result.routerRtpCapabilities.codecs?.[0]?.mimeType).toBe('audio/opus');
  });
});

describe('openTransport', () => {
  it('refuses a send transport to a session that holds no claim', async () => {
    await expect(
      openTransport(socket('guest-a'), listener, { direction: 'send' }),
    ).rejects.toMatchObject({ code: 'not_speaker' });
  });

  it('refuses a second transport in the same direction with a distinct code', async () => {
    await openTransport(socket('speaker-a'), speaker, { direction: 'send' });

    await expect(
      openTransport(socket('speaker-a'), speaker, { direction: 'send' }),
    ).rejects.toMatchObject({ code: 'transport_exists' });
  });

  it('gives a speaker both a send and a receive transport', async () => {
    await openTransport(socket('speaker-a'), speaker, { direction: 'send' });

    await expect(
      openTransport(socket('speaker-a'), speaker, { direction: 'recv' }),
    ).resolves.toMatchObject({ id: expect.any(String) });
  });

  it('returns the ICE and DTLS parameters the client needs', async () => {
    const transport = await openTransport(socket('speaker-a'), speaker, { direction: 'send' });

    expect(transport.iceParameters).toBeDefined();
    expect(transport.iceCandidates).toBeInstanceOf(Array);
    expect(transport.dtlsParameters).toBeDefined();
  });
});

describe('connectTransport', () => {
  it('acks with an empty object', async () => {
    const transport = await openTransport(socket('speaker-a'), speaker, { direction: 'send' });

    await expect(
      connectTransport(socket('speaker-a'), speaker, {
        transportId: transport.id,
        dtlsParameters: { fingerprints: [] },
      }),
    ).resolves.toEqual({});
  });

  it('refuses a transport this session does not hold', async () => {
    await openTransport(socket('speaker-a'), speaker, { direction: 'send' });

    await expect(
      connectTransport(socket('speaker-a'), speaker, {
        transportId: 'someone-elses',
        dtlsParameters: { fingerprints: [] },
      }),
    ).rejects.toMatchObject({ code: 'no_transport' });
  });
});

describe('startProducing', () => {
  it('creates a producer for the claim holder and reports the channel online', async () => {
    const { producerId } = await goLive();

    expect(producerId).toBeDefined();
    expect(isOnline(eventId, englishId)).toBe(true);
  });

  it('refuses a socket that holds the claim for a different channel', async () => {
    await openTransport(socket('speaker-a'), speaker, { direction: 'send' });

    await expect(
      startProducing(db, socket('speaker-a'), speaker, {
        slug: 'spanish',
        rtpParameters: { codecs: [] },
      }),
    ).rejects.toMatchObject({ code: 'not_speaker' });
    expect(isOnline(eventId, spanishId)).toBe(false);
  });

  it('refuses a listener outright', async () => {
    await expect(
      startProducing(db, socket('guest-a'), listener, {
        slug: 'english',
        rtpParameters: { codecs: [] },
      }),
    ).rejects.toMatchObject({ code: 'not_speaker' });
  });

  it('refuses a slug that is not on this socket’s event', async () => {
    await expect(
      startProducing(db, socket('speaker-a'), speaker, {
        slug: foreignSlug,
        rtpParameters: { codecs: [] },
      }),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('replaces rather than duplicating when the claim holder produces twice', async () => {
    const first = await goLive();
    const second = await startProducing(db, socket('speaker-a'), speaker, {
      slug: 'english',
      rtpParameters: { codecs: [] },
    });

    expect(second.producerId).not.toBe(first.producerId);
    expect(isOnline(eventId, englishId)).toBe(true);
  });
});

describe('pause and resume producing', () => {
  it('does not change reported liveness', async () => {
    const { producerId } = await goLive();

    await pauseProducing(socket('speaker-a'), speaker, { producerId });
    expect(isOnline(eventId, englishId)).toBe(true);

    await resumeProducing(socket('speaker-a'), speaker, { producerId });
    expect(isOnline(eventId, englishId)).toBe(true);
  });

  it('refuses a producer that does not exist', async () => {
    await goLive();

    await expect(
      pauseProducing(socket('speaker-a'), speaker, { producerId: 'nope' }),
    ).rejects.toMatchObject({ code: 'no_producer' });
  });

  it('closing a producer takes the channel offline', async () => {
    const { producerId } = await goLive();

    await expect(stopProducing(socket('speaker-a'), speaker, { producerId })).resolves.toEqual({});
    expect(isOnline(eventId, englishId)).toBe(false);
  });

  it('closing a producer that is already gone acks rather than throwing', async () => {
    await goLive();

    await expect(
      stopProducing(socket('speaker-a'), speaker, { producerId: 'nope' }),
    ).resolves.toEqual({});
  });
});

describe('startConsuming', () => {
  it('returns a consumer for a live channel', async () => {
    await goLive();
    await armListener();

    const result = await startConsuming(db, socket('guest-a'), listener, {
      slug: 'english',
      rtpCapabilities: { codecs: [] },
    });

    expect(result.kind).toBe('audio');
    expect(result.consumerId).toBeDefined();
  });

  it('refuses a channel on another event, mirroring the join guard', async () => {
    await goLive();
    await armListener();

    await expect(
      startConsuming(db, socket('guest-a'), listener, {
        slug: foreignSlug,
        rtpCapabilities: { codecs: [] },
      }),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('refuses a channel with nobody broadcasting, with a code rather than a timeout', async () => {
    await goLive();
    await armListener();

    await expect(
      startConsuming(db, socket('guest-a'), listener, {
        slug: 'spanish',
        rtpCapabilities: { codecs: [] },
      }),
    ).rejects.toMatchObject({ code: 'not_live' });
  });

  it('resumes a consumer, and refuses one that does not exist', async () => {
    await goLive();
    await armListener();
    const { consumerId } = await startConsuming(db, socket('guest-a'), listener, {
      slug: 'english',
      rtpCapabilities: { codecs: [] },
    });

    await expect(resumeConsuming(socket('guest-a'), listener, { consumerId })).resolves.toEqual({});
    await expect(
      resumeConsuming(socket('guest-a'), listener, { consumerId: 'nope' }),
    ).rejects.toMatchObject({ code: 'no_consumer' });
  });

  it('closing a consumer that does not exist acks rather than throwing', async () => {
    await goLive();
    await armListener();

    await expect(
      stopConsuming(socket('guest-a'), listener, { consumerId: 'nope' }),
    ).resolves.toEqual({});
  });
});

describe('cross-event isolation', () => {
  it('does not let a socket on another event reach this event’s room', async () => {
    await goLive();

    await expect(
      startConsuming(db, socket('outsider'), foreignAuth, {
        slug: 'english',
        rtpCapabilities: { codecs: [] },
      }),
    ).rejects.toMatchObject({ code: 'not_found' });
  });
});
