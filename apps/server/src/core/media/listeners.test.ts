import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listenerHistory } from '../listener-history';
import type { Notification } from '../notifications';
import { notifications } from '../notifications';
import { presence } from '../presence';
import {
  closeConsumer,
  closeProducer,
  consume,
  createTransport,
  listenerCount,
  listenerCounts,
  releasePeer,
  resumeConsumer,
  revokeChannel,
  stopMedia,
} from './index';
import { ListenerCountPublisher } from './listeners';
import { failWorker, goLive as goLiveOn, startFakeMedia } from './testing';

const WINDOW_MS = 300;

/** A publisher over a settable count, so the coalescing can be driven without mediasoup. */
function harness() {
  const published: Notification[] = [];
  const counts = new Map<string, number>();
  const publisher = new ListenerCountPublisher({
    windowMs: WINDOW_MS,
    count: (eventId, channelId) => counts.get(`${eventId}:${channelId}`) ?? 0,
    publish: (notification) => published.push(notification),
  });
  return {
    published,
    publisher,
    set: (eventId: number, channelId: number, count: number) => {
      counts.set(`${eventId}:${channelId}`, count);
    },
  };
}

describe('ListenerCountPublisher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces several changes inside the window into one notification carrying the final count', async () => {
    const { publisher, published, set } = harness();

    set(1, 10, 1);
    publisher.schedule(1, 10, 'english');
    set(1, 10, 2);
    publisher.schedule(1, 10, 'english');
    await vi.advanceTimersByTimeAsync(WINDOW_MS / 2);
    expect(published).toEqual([]);

    await vi.advanceTimersByTimeAsync(WINDOW_MS);

    expect(published).toEqual([
      { type: 'listeners-changed', eventId: 1, channelId: 10, slug: 'english', count: 2 },
    ]);
    publisher.close();
  });

  it('publishes nothing when the recomputed count matches what was last published', async () => {
    const { publisher, published, set } = harness();

    set(1, 10, 2);
    publisher.schedule(1, 10, 'english');
    await vi.advanceTimersByTimeAsync(WINDOW_MS + 1);
    expect(published).toHaveLength(1);

    // Up and back down again inside one window: nobody's count actually changed.
    set(1, 10, 3);
    publisher.schedule(1, 10, 'english');
    set(1, 10, 2);
    publisher.schedule(1, 10, 'english');
    await vi.advanceTimersByTimeAsync(WINDOW_MS + 1);

    expect(published).toHaveLength(1);
    publisher.close();
  });

  it('keys the window per channel, so two channels each get their own notification', async () => {
    const { publisher, published, set } = harness();

    set(1, 10, 1);
    set(1, 11, 4);
    publisher.schedule(1, 10, 'english');
    publisher.schedule(1, 11, 'spanish');
    await vi.advanceTimersByTimeAsync(WINDOW_MS + 1);

    expect(published).toEqual([
      { type: 'listeners-changed', eventId: 1, channelId: 10, slug: 'english', count: 1 },
      { type: 'listeners-changed', eventId: 1, channelId: 11, slug: 'spanish', count: 4 },
    ]);
    publisher.close();
  });

  it('resolves a recount whose room has gone to zero rather than throwing', async () => {
    const published: Notification[] = [];
    const publisher = new ListenerCountPublisher({
      windowMs: WINDOW_MS,
      count: () => 0,
      publish: (n) => published.push(n),
    });

    publisher.schedule(1, 10, 'english');
    await vi.advanceTimersByTimeAsync(WINDOW_MS + 1);

    // Nothing was ever published for this channel, so zero is not a change.
    expect(published).toEqual([]);
    publisher.close();
  });

  it('publishes a final zero when the event goes away and forgets what it remembered', async () => {
    const { publisher, published, set } = harness();

    set(1, 10, 2);
    publisher.schedule(1, 10, 'english');
    await vi.advanceTimersByTimeAsync(WINDOW_MS + 1);
    expect(published).toHaveLength(1);

    publisher.forgetEvent(1);

    expect(published[1]).toEqual({
      type: 'listeners-changed',
      eventId: 1,
      channelId: 10,
      slug: 'english',
      count: 0,
    });

    // The memory outliving the room is the bug this guards: a later broadcast must
    // publish its first real count rather than be suppressed as unchanged.
    set(1, 10, 2);
    publisher.schedule(1, 10, 'english');
    await vi.advanceTimersByTimeAsync(WINDOW_MS + 1);

    expect(published).toHaveLength(3);
    expect(published[2]).toMatchObject({ channelId: 10, count: 2 });
    publisher.close();
  });

  it('drops a pending timer for an event that goes away', async () => {
    const { publisher, published, set } = harness();

    set(1, 10, 2);
    publisher.schedule(1, 10, 'english');
    publisher.forgetEvent(1);
    await vi.advanceTimersByTimeAsync(WINDOW_MS + 1);

    expect(published).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
    publisher.close();
  });

  it('leaves no timer behind when it closes', async () => {
    const { publisher, published, set } = harness();

    set(1, 10, 2);
    publisher.schedule(1, 10, 'english');
    publisher.close();
    await vi.advanceTimersByTimeAsync(WINDOW_MS + 1);

    expect(vi.getTimerCount()).toBe(0);
    expect(published).toEqual([]);
  });
});

// --- through the facade ---------------------------------------------------------

const EVENT = 1;
const ENGLISH = 10;

describe('listener counts through the media facade', () => {
  let published: Notification[] = [];
  let unsubscribe: () => void;

  beforeEach(async () => {
    published = [];
    unsubscribe = notifications.subscribe((n) => published.push(n));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await startFakeMedia();
  });

  afterEach(async () => {
    await stopMedia();
    unsubscribe();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const listen = async (socketId: string) => {
    const ctx = { eventId: EVENT, socketId };
    await createTransport(ctx, 'recv', { create: false });
    const { consumerId } = await consume(ctx, {
      channelId: ENGLISH,
      // biome-ignore lint/suspicious/noExplicitAny: the fakes stand in for mediasoup's types.
      rtpCapabilities: {} as any,
    });
    await resumeConsumer(ctx, consumerId);
    return consumerId;
  };

  const changes = () => published.filter((n) => n.type === 'listeners-changed');

  it('is zero for an event with no room at all', () => {
    expect(listenerCount(EVENT, ENGLISH)).toBe(0);
    expect(listenerCounts()).toEqual([]);
  });

  it('counts a guest only once its consumer is resumed', async () => {
    await goLiveOn({ eventId: EVENT, socketId: 'speaker', channelId: ENGLISH, slug: 'english' });
    expect(listenerCount(EVENT, ENGLISH)).toBe(0);

    const ctx = { eventId: EVENT, socketId: 'guest-a' };
    await createTransport(ctx, 'recv', { create: false });
    const { consumerId } = await consume(ctx, {
      channelId: ENGLISH,
      // biome-ignore lint/suspicious/noExplicitAny: the fakes stand in for mediasoup's types.
      rtpCapabilities: {} as any,
    });
    expect(listenerCount(EVENT, ENGLISH)).toBe(0);

    await resumeConsumer(ctx, consumerId);
    expect(listenerCount(EVENT, ENGLISH)).toBe(1);
  });

  it('publishes one notification for two guests arriving inside the window', async () => {
    await goLiveOn({ eventId: EVENT, socketId: 'speaker', channelId: ENGLISH, slug: 'english' });
    vi.useFakeTimers();

    await listen('guest-a');
    await listen('guest-b');
    await vi.advanceTimersByTimeAsync(WINDOW_MS + 1);

    expect(changes()).toEqual([
      { type: 'listeners-changed', eventId: EVENT, channelId: ENGLISH, slug: 'english', count: 2 },
    ]);
  });

  it('drops the count when a guest leaves while the broadcast carries on', async () => {
    await goLiveOn({ eventId: EVENT, socketId: 'speaker', channelId: ENGLISH, slug: 'english' });
    vi.useFakeTimers();

    const leaving = await listen('guest-a');
    await listen('guest-b');
    await vi.advanceTimersByTimeAsync(WINDOW_MS + 1);
    expect(listenerCount(EVENT, ENGLISH)).toBe(2);

    // The path `media:close-consumer` takes: the guest un-arms or switches channel while
    // the producer and every other listener stay exactly where they were.
    await closeConsumer({ eventId: EVENT, socketId: 'guest-a' }, leaving);
    await vi.advanceTimersByTimeAsync(WINDOW_MS + 1);

    expect(listenerCount(EVENT, ENGLISH)).toBe(1);
    expect(changes().at(-1)).toEqual({
      type: 'listeners-changed',
      eventId: EVENT,
      channelId: ENGLISH,
      slug: 'english',
      count: 1,
    });
  });

  it('drops the count when a listening guest disconnects outright', async () => {
    await goLiveOn({ eventId: EVENT, socketId: 'speaker', channelId: ENGLISH, slug: 'english' });
    vi.useFakeTimers();

    await listen('guest-a');
    await vi.advanceTimersByTimeAsync(WINDOW_MS + 1);
    expect(listenerCount(EVENT, ENGLISH)).toBe(1);

    releasePeer(EVENT, 'guest-a');
    await vi.advanceTimersByTimeAsync(WINDOW_MS + 1);

    expect(listenerCount(EVENT, ENGLISH)).toBe(0);
    expect(changes().at(-1)).toEqual({
      type: 'listeners-changed',
      eventId: EVENT,
      channelId: ENGLISH,
      slug: 'english',
      count: 0,
    });
  });

  it('reports every active room and channel with its count', async () => {
    await goLiveOn({ eventId: EVENT, socketId: 'speaker', channelId: ENGLISH, slug: 'english' });
    await listen('guest-a');

    expect(listenerCounts()).toEqual([
      { eventId: EVENT, channels: [{ channelId: ENGLISH, slug: 'english', count: 1 }] },
    ]);
  });

  it('leaves no timer behind when the media layer stops with a publish pending', async () => {
    await goLiveOn({ eventId: EVENT, socketId: 'speaker', channelId: ENGLISH, slug: 'english' });
    vi.useFakeTimers();
    await listen('guest-a');

    // The consumer closes inside closeAll() and would arm a fresh timer behind a drain
    // that ran first, which is why the drain happens after the teardown.
    await stopMedia();

    expect(vi.getTimerCount()).toBe(0);
  });
});

// --- the listener history it feeds ----------------------------------------------

describe('listener history through the media facade', () => {
  beforeEach(async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await startFakeMedia();
  });

  afterEach(async () => {
    await stopMedia();
    presence.releaseChannel(ENGLISH);
    listenerHistory.close();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const listen = async (socketId: string) => {
    const ctx = { eventId: EVENT, socketId };
    await createTransport(ctx, 'recv', { create: false });
    const { consumerId } = await consume(ctx, {
      channelId: ENGLISH,
      // biome-ignore lint/suspicious/noExplicitAny: the fakes stand in for mediasoup's types.
      rtpCapabilities: {} as any,
    });
    await resumeConsumer(ctx, consumerId);
    return consumerId;
  };

  const counts = () =>
    listenerHistory
      .snapshot(EVENT, ENGLISH, listenerCount(EVENT, ENGLISH))
      ?.map((point) => point.count);

  it('records a point per coalesced change, in the order they happened', async () => {
    await goLiveOn({ eventId: EVENT, socketId: 'speaker', channelId: ENGLISH, slug: 'english' });
    vi.useFakeTimers();

    const leaving = await listen('guest-a');
    await vi.advanceTimersByTimeAsync(WINDOW_MS + 1);
    await listen('guest-b');
    await vi.advanceTimersByTimeAsync(WINDOW_MS + 1);
    await closeConsumer({ eventId: EVENT, socketId: 'guest-a' }, leaving);
    await vi.advanceTimersByTimeAsync(WINDOW_MS + 1);

    expect(counts()).toEqual([0, 1, 2, 1]);
  });

  it('forgets on a deliberate end, so the next broadcast starts from nothing', async () => {
    const { producerId } = await goLiveOn({
      eventId: EVENT,
      socketId: 'speaker',
      channelId: ENGLISH,
      slug: 'english',
    });
    vi.useFakeTimers();
    await listen('guest-a');
    await vi.advanceTimersByTimeAsync(WINDOW_MS + 1);
    expect(counts()).toEqual([0, 1]);

    await closeProducer({ eventId: EVENT, socketId: 'speaker' }, ENGLISH, producerId);
    await vi.advanceTimersByTimeAsync(WINDOW_MS + 1);
    expect(counts()).toBeUndefined();

    vi.useRealTimers();
    await goLiveOn({ eventId: EVENT, socketId: 'speaker-2', channelId: ENGLISH, slug: 'english' });

    expect(counts()).toEqual([0]);
  });

  it('forgets when the channel is revoked, and a trailing zero recount does not revive it', async () => {
    await goLiveOn({ eventId: EVENT, socketId: 'speaker', channelId: ENGLISH, slug: 'english' });
    vi.useFakeTimers();
    await listen('guest-a');
    await vi.advanceTimersByTimeAsync(WINDOW_MS + 1);
    expect(counts()).toEqual([0, 1]);

    revokeChannel(EVENT, ENGLISH, 'access_revoked');
    await vi.advanceTimersByTimeAsync(WINDOW_MS + 1);

    expect(counts()).toBeUndefined();
  });

  /**
   * A dead worker keeps the claim and its start while clients renegotiate, so the hour
   * before it must survive — forgetting there would draw a flat zero over a live audience.
   */
  it('keeps the history a worker death interrupts', async () => {
    await goLiveOn({ eventId: EVENT, socketId: 'speaker', channelId: ENGLISH, slug: 'english' });
    vi.useFakeTimers();
    await listen('guest-a');
    await listen('guest-b');
    await vi.advanceTimersByTimeAsync(WINDOW_MS + 1);
    expect(counts()).toEqual([0, 2]);

    failWorker();
    await vi.advanceTimersByTimeAsync(WINDOW_MS + 1);

    expect(presence.claimOf(ENGLISH)).toBeDefined();
    expect(counts()).toEqual([0, 2, 0]);
  });

  it('keeps the history when a producer drops rather than ends', async () => {
    await goLiveOn({ eventId: EVENT, socketId: 'speaker', channelId: ENGLISH, slug: 'english' });
    vi.useFakeTimers();
    await listen('guest-a');
    await vi.advanceTimersByTimeAsync(WINDOW_MS + 1);

    // The speaker's connection goes; the claim stays with the session that may come back.
    releasePeer(EVENT, 'speaker');
    await vi.advanceTimersByTimeAsync(WINDOW_MS + 1);

    expect(presence.claimOf(ENGLISH)).toBeDefined();
    expect(counts()).toEqual([0, 1, 0]);
  });
});
