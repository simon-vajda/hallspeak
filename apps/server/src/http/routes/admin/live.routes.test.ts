import { AdminLiveEvent } from '@linguacast/contract/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  activeRooms,
  consume,
  createTransport,
  releasePeer,
  resumeConsumer,
  stopMedia,
} from '../../../core/media';
import { goLive, startFakeMedia } from '../../../core/media/testing';
import { createTestApi } from '../../../testing/api';

const EVENT = 1;
const ENGLISH = 10;
const GRACE_MS = 60_000;

let api: Awaited<ReturnType<typeof createTestApi>>['api'];
let cleanup: () => void;

beforeAll(async () => {
  ({ api, cleanup } = await createTestApi());
});

afterAll(() => {
  cleanup();
});

afterEach(async () => {
  await stopMedia();
});

type LiveEvent = {
  eventId: number;
  channels: { channelId: number; slug: string; online: boolean; listeners: number }[];
};

const live = async (): Promise<LiveEvent[]> => {
  const res = await api.request('/admin/live');
  expect(res.status).toBe(200);
  return (await res.json()) as LiveEvent[];
};

/** A guest is counted only once its consumer is resumed, so the test drives both steps. */
const listen = async (socketId: string) => {
  const ctx = { eventId: EVENT, socketId };
  await createTransport(ctx, 'recv', { create: false });
  const { consumerId } = await consume(ctx, {
    channelId: ENGLISH,
    // biome-ignore lint/suspicious/noExplicitAny: the fakes stand in for mediasoup's types.
    rtpCapabilities: {} as any,
  });
  await resumeConsumer(ctx, consumerId);
};

describe('GET /admin/live', () => {
  it('answers an empty array when the media layer was never started', async () => {
    expect(await live()).toEqual([]);
  });

  it('answers an empty array when no event has an active room', async () => {
    await startFakeMedia({ graceMs: GRACE_MS });

    expect(await live()).toEqual([]);
  });

  it('reports a live channel with no listeners as present and zero', async () => {
    await startFakeMedia({ graceMs: GRACE_MS });
    await goLive({ eventId: EVENT, socketId: 'speaker', channelId: ENGLISH, slug: 'english' });

    expect(await live()).toEqual([
      {
        eventId: EVENT,
        channels: [{ channelId: ENGLISH, slug: 'english', online: true, listeners: 0 }],
      },
    ]);
  });

  it('reports the event once with its two listeners', async () => {
    await startFakeMedia({ graceMs: GRACE_MS });
    await goLive({ eventId: EVENT, socketId: 'speaker', channelId: ENGLISH, slug: 'english' });
    await listen('guest-a');
    await listen('guest-b');

    const body = await live();

    expect(body).toHaveLength(1);
    expect(body[0]).toEqual({
      eventId: EVENT,
      channels: [{ channelId: ENGLISH, slug: 'english', online: true, listeners: 2 }],
    });
  });

  it('omits an event whose producers have all closed while its room waits out the grace period', async () => {
    await startFakeMedia({ graceMs: GRACE_MS });
    await goLive({ eventId: EVENT, socketId: 'speaker', channelId: ENGLISH, slug: 'english' });

    // The speaker's transport goes, taking the producer with it: the room survives the
    // grace period with nothing live on it, and an event with no live channel is absent.
    releasePeer(EVENT, 'speaker');
    expect(activeRooms()).toHaveLength(1);

    expect(await live()).toEqual([]);
  });

  it('answers a body the contract schema accepts', async () => {
    await startFakeMedia({ graceMs: GRACE_MS });
    await goLive({ eventId: EVENT, socketId: 'speaker', channelId: ENGLISH, slug: 'english' });
    await listen('guest-a');

    const res = await api.request('/admin/live');

    expect(z.array(AdminLiveEvent).safeParse(await res.json()).success).toBe(true);
  });
});
