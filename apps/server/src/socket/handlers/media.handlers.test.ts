import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SocketAuth } from '../../core/access';
import { createChannel } from '../../core/channels.service';
import { createEvent } from '../../core/events.service';
import { channelStatus, isOnline } from '../../core/media';
import { fakeMediaControls, startFakeMedia } from '../../core/media/testing';
import { type Notification, notifications } from '../../core/notifications';
import type { Db } from '../../db/client';
import { createTestDb } from '../../db/testing';
import {
  connectTransport,
  getCapabilities,
  openTransport,
  pauseProducing,
  releaseTransport,
  restartTransport,
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
  ({ db, cleanup: cleanupDb } = createTestDb());
  stopMedia = await startFakeMedia();

  const event = createEvent(db, { name: 'Sunday', enabled: true });
  eventId = event.id;
  englishId = createChannel(db, event.id, { slug: 'english', name: 'English', enabled: true }).id;
  spanishId = createChannel(db, event.id, { slug: 'spanish', name: 'Spanish', enabled: true }).id;

  const other = createEvent(db, { name: 'Conference', enabled: true });
  createChannel(db, other.id, { slug: 'french', name: 'French', enabled: true });
  foreignSlug = 'french';
  foreignAuth = { eventId: other.id, pin: other.pin, speakerChannelId: null, studioSession: null };

  speaker = {
    eventId,
    pin: event.pin,
    speakerChannelId: englishId,
    studioSession: 'studio-english',
  };
  listener = { eventId, pin: event.pin, speakerChannelId: null, studioSession: null };
});

afterEach(async () => {
  await stopMedia();
  cleanupDb();
  vi.restoreAllMocks();
});

/** The three calls a speaker makes, through the handlers rather than the facade. */
async function goLive(id = 'speaker-a', auth = speaker, slug = 'english') {
  await openTransport(socket(id), auth, { direction: 'send' });
  return startProducing(db, socket(id), auth, {
    slug,
    rtpParameters: { codecs: [] },
    paused: false,
  });
}

async function armListener(id = 'guest-a') {
  await openTransport(socket(id), listener, { direction: 'recv' });
}

describe('getCapabilities', () => {
  it('returns the router capabilities to a speaker, creating the room', async () => {
    const result = await getCapabilities(socket('speaker-a'), speaker);

    expect(result.routerRtpCapabilities.codecs?.[0]?.mimeType).toBe('audio/opus');
  });

  it('returns no ICE servers when no STUN server is configured', async () => {
    const result = await getCapabilities(socket('speaker-a'), speaker);

    expect(result.iceServers).toEqual([]);
  });

  it('returns the configured STUN server as the only ICE server', async () => {
    await stopMedia();
    stopMedia = await startFakeMedia({ stunUrl: 'stun:stun.example.org:3478' });

    const result = await getCapabilities(socket('speaker-a'), speaker);

    expect(result.iceServers).toEqual([{ urls: ['stun:stun.example.org:3478'] }]);
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

describe('restartTransport', () => {
  it('returns fresh ICE parameters for this session transport', async () => {
    const transport = await openTransport(socket('speaker-a'), speaker, { direction: 'send' });

    await expect(
      restartTransport(socket('speaker-a'), speaker, { transportId: transport.id }),
    ).resolves.toEqual({ iceParameters: { usernameFragment: 'restart-1' } });
  });

  it('refuses a transport this session does not hold', async () => {
    await openTransport(socket('speaker-a'), speaker, { direction: 'send' });

    await expect(
      restartTransport(socket('speaker-a'), speaker, { transportId: 'someone-elses' }),
    ).rejects.toMatchObject({ code: 'no_transport' });
  });
});

describe('releaseTransport', () => {
  it('frees the direction so the same socket can open a fresh transport', async () => {
    const first = await openTransport(socket('speaker-a'), speaker, { direction: 'recv' });

    await expect(
      openTransport(socket('speaker-a'), speaker, { direction: 'recv' }),
    ).rejects.toMatchObject({ code: 'transport_exists' });

    releaseTransport(socket('speaker-a'), speaker, { transportId: first.id });

    const second = await openTransport(socket('speaker-a'), speaker, { direction: 'recv' });
    expect(second.id).not.toBe(first.id);
  });

  it('ignores a transport this session does not hold', async () => {
    await openTransport(socket('speaker-a'), speaker, { direction: 'recv' });

    expect(() =>
      releaseTransport(socket('speaker-a'), speaker, { transportId: 'someone-elses' }),
    ).not.toThrow();
  });
});

describe('startProducing', () => {
  it('creates a producer for the claim holder and reports the channel online', async () => {
    const { producerId } = await goLive();

    expect(producerId).toBeDefined();
    expect(isOnline(eventId, englishId)).toBe(true);
  });

  it('creates a reconnecting producer in its validated paused state', async () => {
    await openTransport(socket('speaker-a'), speaker, { direction: 'send' });

    await startProducing(db, socket('speaker-a'), speaker, {
      slug: 'english',
      rtpParameters: { codecs: [] },
      paused: true,
    });

    expect(channelStatus(eventId, englishId)).toMatchObject({ online: true, muted: true });
  });

  it('refuses a socket that holds the claim for a different channel', async () => {
    await openTransport(socket('speaker-a'), speaker, { direction: 'send' });

    await expect(
      startProducing(db, socket('speaker-a'), speaker, {
        slug: 'spanish',
        rtpParameters: { codecs: [] },
        paused: false,
      }),
    ).rejects.toMatchObject({ code: 'not_speaker' });
    expect(isOnline(eventId, spanishId)).toBe(false);
  });

  it('refuses a listener outright', async () => {
    await expect(
      startProducing(db, socket('guest-a'), listener, {
        slug: 'english',
        rtpParameters: { codecs: [] },
        paused: false,
      }),
    ).rejects.toMatchObject({ code: 'not_speaker' });
  });

  it('refuses a slug that is not on this socket’s event', async () => {
    await expect(
      startProducing(db, socket('speaker-a'), speaker, {
        slug: foreignSlug,
        rtpParameters: { codecs: [] },
        paused: false,
      }),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('replaces rather than duplicating when the claim holder produces twice', async () => {
    const first = await goLive();
    const second = await startProducing(db, socket('speaker-a'), speaker, {
      slug: 'english',
      rtpParameters: { codecs: [] },
      paused: false,
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
    expect(channelStatus(eventId, englishId)).toMatchObject({ online: true, muted: true });

    await resumeProducing(socket('speaker-a'), speaker, { producerId });
    expect(isOnline(eventId, englishId)).toBe(true);
    expect(channelStatus(eventId, englishId)).toMatchObject({ online: true, muted: false });
  });

  it('refuses a producer that does not exist', async () => {
    await goLive();

    await expect(
      pauseProducing(socket('speaker-a'), speaker, { producerId: 'nope' }),
    ).rejects.toMatchObject({ code: 'no_producer' });
  });

  it('closing a producer takes the channel offline', async () => {
    const { producerId } = await goLive();
    const published: Notification[] = [];
    const unsubscribe = notifications.subscribe((notification) => published.push(notification));

    try {
      await expect(stopProducing(socket('speaker-a'), speaker, { producerId })).resolves.toEqual(
        {},
      );
    } finally {
      unsubscribe();
    }
    expect(isOnline(eventId, englishId)).toBe(false);
    expect(published).toContainEqual({
      type: 'producer-closed',
      eventId,
      channelId: englishId,
      slug: 'english',
      reason: 'ended',
    });
  });

  it('closing a producer that is already gone acks rather than throwing', async () => {
    await goLive();

    await expect(
      stopProducing(socket('speaker-a'), speaker, { producerId: 'nope' }),
    ).resolves.toEqual({});
  });
});

/**
 * The consume ack hands a producer id to every listener on the event, so a producer verb
 * that resolved one by id alone would let anybody holding the PIN silence any channel.
 * These are the tests whose absence let that ship.
 */
describe('producer control is scoped to the claim', () => {
  it('refuses a listener trying to pause a producer, even with the real id', async () => {
    const { producerId } = await goLive();
    await armListener();

    await expect(pauseProducing(socket('guest-a'), listener, { producerId })).rejects.toMatchObject(
      { code: 'not_speaker' },
    );
    expect(isOnline(eventId, englishId)).toBe(true);
  });

  it('refuses a listener trying to close a producer', async () => {
    const { producerId } = await goLive();

    await expect(stopProducing(socket('guest-a'), listener, { producerId })).rejects.toMatchObject({
      code: 'not_speaker',
    });
    expect(isOnline(eventId, englishId)).toBe(true);
  });

  it('refuses a listener trying to resume a producer', async () => {
    const { producerId } = await goLive();

    await expect(
      resumeProducing(socket('guest-a'), listener, { producerId }),
    ).rejects.toMatchObject({ code: 'not_speaker' });
    expect(isOnline(eventId, englishId)).toBe(true);
  });

  it('refuses a speaker acting on another channel’s producer', async () => {
    const spanishSpeaker = {
      eventId,
      pin: speaker.pin,
      speakerChannelId: spanishId,
      studioSession: 'studio-spanish',
    };
    const { producerId } = await goLive();
    await openTransport(socket('speaker-b'), spanishSpeaker, { direction: 'send' });
    await startProducing(db, socket('speaker-b'), spanishSpeaker, {
      slug: 'spanish',
      rtpParameters: { codecs: [] },
      paused: false,
    });

    // Holding a claim of their own, so the refusal is about the producer they named rather
    // than about their right to broadcast at all.
    await expect(
      pauseProducing(socket('speaker-b'), spanishSpeaker, { producerId }),
    ).rejects.toMatchObject({ code: 'no_producer' });
    expect(isOnline(eventId, englishId)).toBe(true);
  });

  it('lets the claim holder pause their own producer', async () => {
    const { producerId } = await goLive();

    await expect(pauseProducing(socket('speaker-a'), speaker, { producerId })).resolves.toEqual({});
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

  /** Uncapped, one PIN holder could fan a channel out as many times as they asked. */
  it('returns the same consumer rather than allocating another for one channel', async () => {
    await goLive();
    await armListener();

    const first = await startConsuming(db, socket('guest-a'), listener, {
      slug: 'english',
      rtpCapabilities: { codecs: [] },
    });
    const second = await startConsuming(db, socket('guest-a'), listener, {
      slug: 'english',
      rtpCapabilities: { codecs: [] },
    });

    expect(second.consumerId).toBe(first.consumerId);
  });

  it('refuses a device that cannot play the codec, with its own code', async () => {
    fakeMediaControls.refuseConsume = true;
    await goLive();
    await armListener();

    await expect(
      startConsuming(db, socket('guest-a'), listener, {
        slug: 'english',
        rtpCapabilities: { codecs: [] },
      }),
    ).rejects.toMatchObject({ code: 'incompatible_client' });
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

describe('a second studio on the same speaker code', () => {
  const colleague = (): SocketAuth => ({
    eventId,
    pin: speaker.pin,
    speakerChannelId: englishId,
    studioSession: 'studio-english-second',
  });

  it('does not disturb the live broadcast by connecting and is refused if it produces', async () => {
    const { producerId } = await goLive();

    await expect(goLive('speaker-b', colleague())).rejects.toMatchObject({
      code: 'channel_taken',
    });
    expect(channelStatus(eventId, englishId)).toMatchObject({ online: true, producerId });
  });

  it('cannot mute or end the interpreter who holds the channel', async () => {
    const { producerId } = await goLive();
    const second = colleague();

    await expect(pauseProducing(socket('speaker-b'), second, { producerId })).rejects.toMatchObject(
      { code: 'channel_taken' },
    );
    // Ending is a no-op rather than a refusal: there is nothing left for this studio to end.
    await expect(stopProducing(socket('speaker-b'), second, { producerId })).resolves.toEqual({});
    expect(isOnline(eventId, englishId)).toBe(true);
  });
});
