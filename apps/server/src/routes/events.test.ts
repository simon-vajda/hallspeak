import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../db/client';
import { createChannel, createEvent } from '../events/queries';
import { presence } from '../signal/presence';
import { createTestApi } from '../testing/api';

let api: Awaited<ReturnType<typeof createTestApi>>['api'];
let db: Db;
let cleanup: () => void;

// Fixtures shared by every test below. Seeded once: none of these tests mutate rows.
let live: { pin: string; slug: string; speakerCode: string; channelId: number };
let disabledEvent: { pin: string };
let disabledChannel: { pin: string; slug: string; speakerCode: string };
let otherChannelCode: string;

beforeAll(async () => {
  ({ api, db, cleanup } = await createTestApi());

  const event = createEvent(db, { name: 'Sunday Service', description: 'Weekly', enabled: true });
  const english = createChannel(db, event.id, { slug: 'english', name: 'English', enabled: true });
  const spanish = createChannel(db, event.id, { slug: 'spanish', name: 'Spanish', enabled: true });
  const off = createChannel(db, event.id, { slug: 'german', name: 'German' });
  live = {
    pin: event.pin,
    slug: 'english',
    speakerCode: english.speakerCode,
    channelId: english.id,
  };
  otherChannelCode = spanish.speakerCode;
  disabledChannel = { pin: event.pin, slug: 'german', speakerCode: off.speakerCode };

  const hidden = createEvent(db, { name: 'Next Month' });
  disabledEvent = { pin: hidden.pin };
});

afterAll(() => {
  cleanup();
});

describe('GET /events/{pin}', () => {
  it('returns the event with its enabled channels only', async () => {
    const res = await api.request(`/events/${live.pin}`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      pin: live.pin,
      name: 'Sunday Service',
      description: 'Weekly',
      channels: [
        { slug: 'english', name: 'English', online: false },
        { slug: 'spanish', name: 'Spanish', online: false },
      ],
    });
  });

  it('reports a channel online while a speaker holds it', async () => {
    presence.claim(live.channelId, 'socket-x');
    try {
      const res = await api.request(`/events/${live.pin}`);
      const body = (await res.json()) as { channels: { slug: string; online: boolean }[] };

      expect(body.channels.find((c) => c.slug === 'english')?.online).toBe(true);
    } finally {
      presence.release('socket-x');
    }
  });

  it('rejects a malformed pin before it reaches the database', async () => {
    expect((await api.request('/events/12345')).status).toBe(400);
  });
});

// The point of the spec's 404 parity rule: three different reasons, one response.
describe('404 parity', () => {
  it('answers identically for a missing pin, a disabled event and a disabled channel', async () => {
    const missing = await api.request('/events/000000');
    const disabled = await api.request(`/events/${disabledEvent.pin}`);
    const channelOff = await api.request(`/events/${disabledChannel.pin}/${disabledChannel.slug}`);

    expect(missing.status).toBe(404);
    expect(disabled.status).toBe(404);
    expect(channelOff.status).toBe(404);

    const bodies = await Promise.all([missing.text(), disabled.text(), channelOff.text()]);
    expect(bodies[0]).toBe(bodies[1]);
    expect(bodies[1]).toBe(bodies[2]);
  });
});

describe('GET /events/{pin}/{slug}', () => {
  it('returns role listener without a code', async () => {
    const res = await api.request(`/events/${live.pin}/${live.slug}`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      event: { pin: live.pin, name: 'Sunday Service' },
      channel: { slug: 'english', name: 'English', online: false },
      role: 'listener',
    });
  });

  it('returns role speaker for the matching code', async () => {
    const res = await api.request(
      `/events/${live.pin}/${live.slug}?speaker_code=${live.speakerCode}`,
    );
    const body = (await res.json()) as { role: string };

    expect(res.status).toBe(200);
    expect(body.role).toBe('speaker');
  });

  // The code identifies a channel on its own, so the URL names the channel twice;
  // disagreement is an error, not a case where one side wins (spec E §5).
  it('rejects a code belonging to a different channel with 403', async () => {
    const res = await api.request(
      `/events/${live.pin}/${live.slug}?speaker_code=${otherChannelCode}`,
    );

    expect(res.status).toBe(403);
  });

  it('rejects a nonsense code with 403', async () => {
    const res = await api.request(`/events/${live.pin}/${live.slug}?speaker_code=nope`);

    expect(res.status).toBe(403);
  });

  // 404 wins over 403: a disabled channel must not confirm that the code was right.
  it('answers 404, not 403, for a valid code on a disabled channel', async () => {
    const res = await api.request(
      `/events/${disabledChannel.pin}/${disabledChannel.slug}?speaker_code=${disabledChannel.speakerCode}`,
    );

    expect(res.status).toBe(404);
  });

  it('answers 404 for an unknown slug', async () => {
    expect((await api.request(`/events/${live.pin}/klingon`)).status).toBe(404);
  });
});
