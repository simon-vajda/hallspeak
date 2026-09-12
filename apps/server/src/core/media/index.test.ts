import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Notification } from '../notifications';
import { notifications } from '../notifications';
import { presence } from '../presence';
import { reports } from '../reports';
import {
  activeRooms,
  channelStatus,
  closeConsumer,
  closeProducer,
  consume,
  createTransport,
  isOnline,
  pauseProducer,
  produce,
  releasePeer,
  restartIce,
  resumeConsumer,
  resumeProducer,
  revokeChannel,
  revokeEvent,
  stopMedia,
} from './index';
import {
  failWorker,
  fakeListenInfos,
  fakeMediaControls,
  goLive as goLiveOn,
  startFakeMedia,
} from './testing';

const EVENT = 1;
const ENGLISH = 10;
const SPANISH = 11;

let published: Notification[] = [];
let unsubscribe: () => void;

beforeEach(async () => {
  published = [];
  unsubscribe = notifications.subscribe((n) => published.push(n));
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});

  await startFakeMedia();
});

afterEach(async () => {
  await stopMedia();
  unsubscribe();
  // The claim registry is a process singleton; leaving a claim behind leaks into the next test.
  presence.releaseChannel(ENGLISH);
  presence.releaseChannel(SPANISH);
  vi.restoreAllMocks();
});

const takeClaim = (channelId: number, socketId: string) =>
  presence.take({ eventId: EVENT, channelId, sessionId: `${socketId}-studio`, socketId });

const goLive = (socketId: string, channelId = ENGLISH, slug = 'english') =>
  goLiveOn({ eventId: EVENT, socketId, channelId, slug });

const peerConsumer = (socketId: string, consumerId: string) =>
  activeRooms()[0]?.peer(socketId)?.consumerById(consumerId);

describe('isOnline', () => {
  it('is false with no room at all', () => {
    expect(isOnline(EVENT, ENGLISH)).toBe(false);
  });

  it('is true only while an unclosed producer exists', async () => {
    const { producerId } = await goLive('speaker-a');
    expect(isOnline(EVENT, ENGLISH)).toBe(true);

    await closeProducer({ eventId: EVENT, socketId: 'speaker-a' }, ENGLISH, producerId);
    expect(isOnline(EVENT, ENGLISH)).toBe(false);
  });

  it('stays true across a pause, because mute is not the end of a broadcast', async () => {
    const { producerId } = await goLive('speaker-a');
    await pauseProducer({ eventId: EVENT, socketId: 'speaker-a' }, ENGLISH, producerId);

    expect(isOnline(EVENT, ENGLISH)).toBe(true);
  });

  it('is false for a channel of the event nobody is broadcasting on', async () => {
    await goLive('speaker-a');
    expect(isOnline(EVENT, SPANISH)).toBe(false);
  });
});

describe('channelStatus', () => {
  it('tracks mute independently from liveness and clears it on close', async () => {
    expect(channelStatus(EVENT, ENGLISH)).toMatchObject({ online: false, muted: false });

    const { producerId } = await goLive('speaker-a');
    expect(channelStatus(EVENT, ENGLISH)).toMatchObject({ online: true, muted: false });

    await pauseProducer({ eventId: EVENT, socketId: 'speaker-a' }, ENGLISH, producerId);
    expect(channelStatus(EVENT, ENGLISH)).toMatchObject({ online: true, muted: true });

    await resumeProducer({ eventId: EVENT, socketId: 'speaker-a' }, ENGLISH, producerId);
    expect(channelStatus(EVENT, ENGLISH)).toMatchObject({ online: true, muted: false });

    await closeProducer({ eventId: EVENT, socketId: 'speaker-a' }, ENGLISH, producerId);
    expect(channelStatus(EVENT, ENGLISH)).toMatchObject({ online: false, muted: false });
  });
});

describe('produce', () => {
  it('publishes producer-opened naming the channel and its slug', async () => {
    await goLive('speaker-a');

    expect(published).toContainEqual({
      type: 'producer-opened',
      eventId: EVENT,
      channelId: ENGLISH,
      slug: 'english',
    });
  });

  it('publishes ended when the speaker deliberately closes the producer', async () => {
    const { producerId } = await goLive('speaker-a');
    published = [];

    await closeProducer({ eventId: EVENT, socketId: 'speaker-a' }, ENGLISH, producerId);

    expect(published).toContainEqual({
      type: 'producer-closed',
      eventId: EVENT,
      channelId: ENGLISH,
      slug: 'english',
      reason: 'ended',
    });
  });

  it('clears listener feedback when the speaker deliberately ends the broadcast', async () => {
    const { producerId } = await goLive('speaker-a');
    reports.record(EVENT, ENGLISH, 'english', 'guest-a', 'quiet');
    published = [];

    await closeProducer({ eventId: EVENT, socketId: 'speaker-a' }, ENGLISH, producerId);

    expect(reports.snapshot(EVENT, ENGLISH)).toEqual({ rows: [], soundsGood: null });
    expect(published).toContainEqual({
      type: 'reports-changed',
      eventId: EVENT,
      channelId: ENGLISH,
      slug: 'english',
      rows: [],
      soundsGood: null,
    });
  });

  it('publishes dropped when the worker tears its room down', async () => {
    await goLive('speaker-a');
    published = [];

    failWorker();

    await vi.waitFor(() => {
      expect(published).toContainEqual({
        type: 'producer-closed',
        eventId: EVENT,
        channelId: ENGLISH,
        slug: 'english',
        reason: 'dropped',
      });
    });
  });

  it('keeps a live room across a polled address move, evicting nobody', async () => {
    await stopMedia();
    let resolved = '203.0.113.7';
    await startFakeMedia({
      announcedIp: 'media.example.org',
      resolveAddress: async () => [resolved],
      addressPollMs: 1,
    });
    await goLive('speaker-a');
    published = [];

    resolved = '198.51.100.4';
    let guest = 0;
    await vi.waitFor(async () => {
      guest += 1;
      const { iceCandidates } = await createTransport(
        { eventId: EVENT, socketId: `guest-${guest}` },
        'recv',
        { create: false },
      );
      expect(iceCandidates.map((candidate) => candidate.address)).toContain('198.51.100.4');
    });

    expect(isOnline(EVENT, ENGLISH)).toBe(true);
    expect(published.filter((n) => n.type === 'room-evicted')).toEqual([]);
  });

  it('creates an initially paused producer before publishing opened', async () => {
    let statusAtOpened: { online: boolean; muted: boolean } | undefined;
    const unsubscribeStatus = notifications.subscribe((notification) => {
      if (notification.type === 'producer-opened') {
        statusAtOpened = channelStatus(notification.eventId, notification.channelId);
      }
    });
    await createTransport({ eventId: EVENT, socketId: 'speaker-a' }, 'send', { create: true });
    try {
      await produce(
        { eventId: EVENT, socketId: 'speaker-a' },
        {
          channelId: ENGLISH,
          slug: 'english',
          rtpParameters: { codecs: [] },
          paused: true,
        },
      );
    } finally {
      unsubscribeStatus();
    }

    expect(channelStatus(EVENT, ENGLISH)).toMatchObject({ online: true, muted: true });
    expect(statusAtOpened).toMatchObject({ online: true, muted: true });
    expect(published.at(-1)).toEqual({
      type: 'producer-opened',
      eventId: EVENT,
      channelId: ENGLISH,
      slug: 'english',
    });
  });

  it('publishes pause and resume invalidations only after each operation succeeds', async () => {
    const { producerId } = await goLive('speaker-a');
    published = [];
    fakeMediaControls.failPause = true;

    await expect(
      pauseProducer({ eventId: EVENT, socketId: 'speaker-a' }, ENGLISH, producerId),
    ).rejects.toThrow('pause failed');
    expect(published).toEqual([]);

    fakeMediaControls.failPause = false;
    await pauseProducer({ eventId: EVENT, socketId: 'speaker-a' }, ENGLISH, producerId);
    fakeMediaControls.failResume = true;
    await expect(
      resumeProducer({ eventId: EVENT, socketId: 'speaker-a' }, ENGLISH, producerId),
    ).rejects.toThrow('resume failed');
    expect(published.map((notification) => notification.type)).toEqual(['producer-paused']);

    fakeMediaControls.failResume = false;
    await resumeProducer({ eventId: EVENT, socketId: 'speaker-a' }, ENGLISH, producerId);

    expect(published.map((notification) => notification.type)).toEqual([
      'producer-paused',
      'producer-resumed',
    ]);
  });

  it('lands two channels of one event on the same router', async () => {
    await goLive('speaker-a', ENGLISH, 'english');
    await goLive('speaker-b', SPANISH, 'spanish');

    expect(isOnline(EVENT, ENGLISH)).toBe(true);
    expect(isOnline(EVENT, SPANISH)).toBe(true);
  });

  it('refuses to produce without a send transport', async () => {
    await expect(
      produce(
        { eventId: EVENT, socketId: 'nobody' },
        {
          channelId: ENGLISH,
          slug: 'english',
          rtpParameters: { codecs: [] },
          paused: false,
        },
      ),
    ).rejects.toMatchObject({ code: 'no_transport' });
  });
});

describe('muted listener count', () => {
  it('retains a resumed consumer while its producer is paused', async () => {
    const { producerId } = await goLive('speaker-a');
    const guest = { eventId: EVENT, socketId: 'guest-a' };
    await createTransport(guest, 'recv', { create: false });
    const { consumerId } = await consume(guest, {
      channelId: ENGLISH,
      rtpCapabilities: { codecs: [] },
    });
    await resumeConsumer(guest, consumerId);

    await pauseProducer({ eventId: EVENT, socketId: 'speaker-a' }, ENGLISH, producerId);

    expect(channelStatus(EVENT, ENGLISH)).toMatchObject({ online: true, muted: true });
    expect(activeRooms()[0]?.listenerCount(ENGLISH)).toBe(1);
  });
});

describe('consume', () => {
  it('returns a paused consumer for a live channel', async () => {
    await goLive('speaker-a');
    await createTransport({ eventId: EVENT, socketId: 'guest-a' }, 'recv', { create: false });

    const result = await consume(
      { eventId: EVENT, socketId: 'guest-a' },
      { channelId: ENGLISH, rtpCapabilities: { codecs: [] } },
    );

    expect(result.kind).toBe('audio');
    expect(result.consumerId).toBeDefined();
  });

  it('refuses a channel with no producer, with a distinct code rather than a timeout', async () => {
    await goLive('speaker-a');
    await createTransport({ eventId: EVENT, socketId: 'guest-a' }, 'recv', { create: false });

    await expect(
      consume(
        { eventId: EVENT, socketId: 'guest-a' },
        { channelId: SPANISH, rtpCapabilities: { codecs: [] } },
      ),
    ).rejects.toMatchObject({ code: 'not_live' });
  });

  it('closing an unknown consumer acks rather than throwing', async () => {
    await goLive('speaker-a');

    await expect(
      closeConsumer({ eventId: EVENT, socketId: 'speaker-a' }, 'no-such-consumer'),
    ).resolves.toBeUndefined();
  });
});

describe('createTransport', () => {
  it('refuses to create a room for a caller who may not create one', async () => {
    await expect(
      createTransport({ eventId: EVENT, socketId: 'guest-a' }, 'recv', { create: false }),
    ).rejects.toMatchObject({ code: 'not_live' });
  });

  it('refuses a second transport in the same direction', async () => {
    await createTransport({ eventId: EVENT, socketId: 'speaker-a' }, 'send', { create: true });

    await expect(
      createTransport({ eventId: EVENT, socketId: 'speaker-a' }, 'send', { create: true }),
    ).rejects.toMatchObject({ code: 'transport_exists' });
  });

  it('offers both the announced hostname and the address it resolved to', async () => {
    await stopMedia();
    await startFakeMedia({
      announcedIp: 'media.example.org',
      resolveAddress: async () => ['203.0.113.7'],
    });

    const { iceCandidates } = await createTransport(
      { eventId: EVENT, socketId: 'speaker-a' },
      'send',
      { create: true },
    );

    expect(new Set(iceCandidates.map((candidate) => candidate.address))).toEqual(
      new Set(['media.example.org', '203.0.113.7']),
    );
  });

  it('announces the configured hostname to the workers, not the resolved literal', async () => {
    await stopMedia();
    await startFakeMedia({
      announcedIp: 'media.example.org',
      resolveAddress: async () => ['203.0.113.7'],
    });

    expect(fakeListenInfos().map((info) => info.announcedAddress)).toEqual([
      'media.example.org',
      'media.example.org',
    ]);
  });

  it('leaves the list alone when PUBLIC_ADDRESS is already a literal', async () => {
    const { iceCandidates } = await createTransport(
      { eventId: EVENT, socketId: 'speaker-a' },
      'send',
      { create: true },
    );

    expect(iceCandidates).toHaveLength(2);
    expect(iceCandidates.every((candidate) => candidate.address === '203.0.113.1')).toBe(true);
  });

  it('appends the new literal once a polled address has moved', async () => {
    await stopMedia();
    let resolved = '203.0.113.7';
    await startFakeMedia({
      announcedIp: 'media.example.org',
      resolveAddress: async () => [resolved],
      addressPollMs: 1,
    });
    resolved = '198.51.100.4';
    await vi.waitFor(async () => {
      const { iceCandidates } = await createTransport(
        { eventId: EVENT, socketId: `speaker-${resolved}-${Math.random()}` },
        'send',
        { create: true },
      );
      expect(iceCandidates.map((candidate) => candidate.address)).toContain('198.51.100.4');
    });
  });

  it('keeps the last good literal when a refresh stops resolving', async () => {
    await stopMedia();
    let fail = false;
    await startFakeMedia({
      announcedIp: 'media.example.org',
      resolveAddress: async () => {
        if (fail) {
          throw new Error('SERVFAIL');
        }
        return ['203.0.113.7'];
      },
      addressPollMs: 1,
    });
    fail = true;
    await new Promise((resolve) => setTimeout(resolve, 10));

    const { iceCandidates } = await createTransport(
      { eventId: EVENT, socketId: 'speaker-a' },
      'send',
      { create: true },
    );
    expect(iceCandidates.map((candidate) => candidate.address)).toContain('203.0.113.7');
  });

  it('logs the configured hostname and the address it resolved to together', async () => {
    await stopMedia();
    await startFakeMedia({
      announcedIp: 'media.example.org',
      resolveAddress: async () => ['203.0.113.7'],
    });

    const summary = vi
      .mocked(console.log)
      .mock.calls.map(([line]) => String(line))
      .findLast((line) => line.includes('worker(s)'));
    expect(summary).toContain('media.example.org');
    expect(summary).toContain('203.0.113.7');
  });

  it('warns about a private literal, naming the address guests would be given', async () => {
    await stopMedia();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await startFakeMedia({ announcedIp: '192.168.1.20' });

    expect(warn.mock.calls.map(([line]) => String(line)).join('\n')).toContain('192.168.1.20');
  });

  it('refuses to boot on a hostname that resolves only to private addresses', async () => {
    await stopMedia();
    await expect(
      startFakeMedia({
        announcedIp: 'media.example.org',
        resolveAddress: async () => ['10.0.0.5'],
      }),
    ).rejects.toThrow(/private or loopback/);
  });

  it('restarts ICE on an owned transport and refuses an unknown one', async () => {
    const transport = await createTransport({ eventId: EVENT, socketId: 'speaker-a' }, 'send', {
      create: true,
    });

    await expect(
      restartIce({ eventId: EVENT, socketId: 'speaker-a' }, transport.id),
    ).resolves.toEqual({ iceParameters: { usernameFragment: 'restart-1' } });
    await expect(
      restartIce({ eventId: EVENT, socketId: 'speaker-a' }, 'someone-elses'),
    ).rejects.toMatchObject({ code: 'no_transport' });
  });
});

/**
 * What every listener experiences the moment a speaker stops: mediasoup closes their
 * consumer for them, and nothing on either side is told to. Only reachable now that the
 * fake emits the observer close mediasoup emits.
 */
describe('a listener whose speaker stops', () => {
  it('has its consumer closed and forgotten without anyone calling close', async () => {
    const { producerId } = await goLive('speaker-a');
    await createTransport({ eventId: EVENT, socketId: 'guest-a' }, 'recv', { create: false });
    const { consumerId } = await consume(
      { eventId: EVENT, socketId: 'guest-a' },
      { channelId: ENGLISH, rtpCapabilities: { codecs: [] } },
    );
    expect(peerConsumer('guest-a', consumerId)).toBeDefined();

    await closeProducer({ eventId: EVENT, socketId: 'speaker-a' }, ENGLISH, producerId);

    expect(peerConsumer('guest-a', consumerId)).toBeUndefined();
    expect(isOnline(EVENT, ENGLISH)).toBe(false);
  });

  it('can consume again once the speaker returns', async () => {
    const { producerId } = await goLive('speaker-a');
    await createTransport({ eventId: EVENT, socketId: 'guest-a' }, 'recv', { create: false });
    await consume(
      { eventId: EVENT, socketId: 'guest-a' },
      { channelId: ENGLISH, rtpCapabilities: { codecs: [] } },
    );
    await closeProducer({ eventId: EVENT, socketId: 'speaker-a' }, ENGLISH, producerId);

    // The speaker keeps their send transport across this and only produces again.
    await produce(
      { eventId: EVENT, socketId: 'speaker-a' },
      {
        channelId: ENGLISH,
        slug: 'english',
        rtpParameters: { codecs: [] },
        paused: false,
      },
    );
    const again = await consume(
      { eventId: EVENT, socketId: 'guest-a' },
      { channelId: ENGLISH, rtpCapabilities: { codecs: [] } },
    );

    expect(again.consumerId).toBeDefined();
  });
});

describe('revokeChannel', () => {
  it('closes the producer, releases the claim and evicts the holder once', async () => {
    takeClaim(ENGLISH, 'speaker-a');
    await goLive('speaker-a');
    published = [];

    revokeChannel(EVENT, ENGLISH, 'access_revoked');

    expect(isOnline(EVENT, ENGLISH)).toBe(false);
    expect(presence.holder(ENGLISH)).toBeUndefined();
    expect(published.filter((n) => n.type === 'peer-evicted')).toEqual([
      { type: 'peer-evicted', socketId: 'speaker-a', reason: 'access_revoked' },
    ]);
  });

  it('still evicts the claim holder when no producer exists', () => {
    takeClaim(ENGLISH, 'speaker-a');

    revokeChannel(EVENT, ENGLISH, 'access_revoked');

    expect(published).toContainEqual({
      type: 'peer-evicted',
      socketId: 'speaker-a',
      reason: 'access_revoked',
    });
  });

  it('leaves the other channels of the event alone', async () => {
    await goLive('speaker-a', ENGLISH, 'english');
    await goLive('speaker-b', SPANISH, 'spanish');

    revokeChannel(EVENT, ENGLISH, 'access_revoked');

    expect(isOnline(EVENT, SPANISH)).toBe(true);
  });

  it('succeeds and changes nothing for a channel with no producer and no claim', () => {
    expect(() => revokeChannel(EVENT, ENGLISH, 'access_revoked')).not.toThrow();
    expect(published).toEqual([]);
  });
});

describe('revokeEvent', () => {
  it('publishes room-evicted once, not one notification per known peer', async () => {
    await goLive('speaker-a', ENGLISH, 'english');
    await createTransport({ eventId: EVENT, socketId: 'guest-a' }, 'recv', { create: false });
    await createTransport({ eventId: EVENT, socketId: 'guest-b' }, 'recv', { create: false });
    published = [];

    revokeEvent(EVENT, [ENGLISH, SPANISH], 'access_revoked');

    expect(published.filter((n) => n.type === 'room-evicted')).toEqual([
      { type: 'room-evicted', eventId: EVENT, reason: 'access_revoked' },
    ]);
    expect(published.filter((n) => n.type === 'peer-evicted')).toEqual([]);
  });

  it('closes every producer on the event and releases every claim', async () => {
    takeClaim(ENGLISH, 'speaker-a');
    takeClaim(SPANISH, 'speaker-b');
    await goLive('speaker-a', ENGLISH, 'english');
    await goLive('speaker-b', SPANISH, 'spanish');

    revokeEvent(EVENT, [ENGLISH, SPANISH], 'access_revoked');

    expect(isOnline(EVENT, ENGLISH)).toBe(false);
    expect(isOnline(EVENT, SPANISH)).toBe(false);
    expect(presence.holder(ENGLISH)).toBeUndefined();
    expect(presence.holder(SPANISH)).toBeUndefined();
  });

  it('publishes room-evicted even for an event with no room, so listeners still go', () => {
    revokeEvent(EVENT, [ENGLISH], 'access_revoked');

    expect(published).toContainEqual({
      type: 'room-evicted',
      eventId: EVENT,
      reason: 'access_revoked',
    });
  });
});

describe('releasePeer', () => {
  it('closes that socket’s media and publishes its producer closing', async () => {
    await goLive('speaker-a');
    published = [];

    releasePeer(EVENT, 'speaker-a');

    expect(isOnline(EVENT, ENGLISH)).toBe(false);
    expect(published).toContainEqual({
      type: 'producer-closed',
      eventId: EVENT,
      channelId: ENGLISH,
      slug: 'english',
      reason: 'dropped',
    });
  });

  it('is a no-op for a socket that held nothing', () => {
    expect(() => releasePeer(EVENT, 'nobody')).not.toThrow();
  });

  it('leaves the other peers alone', async () => {
    await goLive('speaker-a', ENGLISH, 'english');
    await goLive('speaker-b', SPANISH, 'spanish');

    releasePeer(EVENT, 'speaker-a');

    expect(isOnline(EVENT, SPANISH)).toBe(true);
  });
});
