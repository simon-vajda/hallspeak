import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createChannel } from '../../../core/channels.service';
import { createEvent } from '../../../core/events.service';
import { isOnline } from '../../../core/media';
import { goLive, startFakeMedia } from '../../../core/media/testing';
import type { Notification } from '../../../core/notifications';
import { notifications } from '../../../core/notifications';
import { presence } from '../../../core/presence';
import type { Db } from '../../../db/client';
import { createTestApi } from '../../../testing/api';

let api: Awaited<ReturnType<typeof createTestApi>>['api'];
let db: Db;
let cleanup: () => void;
let stopMedia: () => Promise<void>;
let published: Notification[];
let unsubscribe: () => void;

let eventId: number;
let english: { id: number; speakerCode: string };
let spanish: { id: number };

// The test API opens the `db` singleton, so it is per-file: cleaning it up per test
// would close that connection for every test after the first.
beforeAll(async () => {
  ({ api, db, cleanup } = await createTestApi());
});

afterAll(() => {
  cleanup();
});

beforeEach(async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  stopMedia = await startFakeMedia();

  const event = createEvent(db, { name: 'Sunday', enabled: true });
  eventId = event.id;
  english = createChannel(db, event.id, { slug: 'english', name: 'English', enabled: true });
  spanish = createChannel(db, event.id, { slug: 'spanish', name: 'Spanish', enabled: true });

  published = [];
  unsubscribe = notifications.subscribe((n) => published.push(n));
});

afterEach(async () => {
  unsubscribe();
  await stopMedia();
  presence.releaseChannel(english.id);
  presence.releaseChannel(spanish.id);
  vi.restoreAllMocks();
});

const patch = (path: string, body: unknown) =>
  api.request(path, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

async function broadcast(channelId: number, slug: string, socketId: string, code: string) {
  presence.claim(channelId, code, socketId);
  await goLive({ eventId, socketId, channelId, slug });
}

const evictedSockets = () =>
  published.filter((n) => n.type === 'peer-evicted').map((n) => n.socketId);
const roomEvictions = () => published.filter((n) => n.type === 'room-evicted');

describe('regenerating a speaker code', () => {
  it('closes the producer, releases the claim and evicts that speaker', async () => {
    await broadcast(english.id, 'english', 'speaker-a', english.speakerCode);

    const res = await api.request(`/admin/channels/${english.id}/regenerate-speaker-code`, {
      method: 'POST',
    });

    expect(res.status).toBe(200);
    expect(isOnline(eventId, english.id)).toBe(false);
    expect(presence.holder(english.id)).toBeUndefined();
    expect(evictedSockets()).toEqual(['speaker-a']);
  });

  it('leaves the other channels of the event broadcasting', async () => {
    await broadcast(english.id, 'english', 'speaker-a', english.speakerCode);
    await broadcast(spanish.id, 'spanish', 'speaker-b', 'code-spanish');

    await api.request(`/admin/channels/${english.id}/regenerate-speaker-code`, { method: 'POST' });

    expect(isOnline(eventId, spanish.id)).toBe(true);
    expect(presence.holder(spanish.id)).toBe('speaker-b');
  });

  it('revokes after the write, so the new code is already in the response', async () => {
    await broadcast(english.id, 'english', 'speaker-a', english.speakerCode);

    const res = await api.request(`/admin/channels/${english.id}/regenerate-speaker-code`, {
      method: 'POST',
    });
    const body = (await res.json()) as { speakerCode: string };

    expect(body.speakerCode).not.toBe(english.speakerCode);
    expect(evictedSockets()).toEqual(['speaker-a']);
  });
});

describe('disabling and deleting a channel', () => {
  it('disabling closes that channel’s producer and leaves the others', async () => {
    await broadcast(english.id, 'english', 'speaker-a', english.speakerCode);
    await broadcast(spanish.id, 'spanish', 'speaker-b', 'code-spanish');

    await patch(`/admin/channels/${english.id}`, { enabled: false });

    expect(isOnline(eventId, english.id)).toBe(false);
    expect(isOnline(eventId, spanish.id)).toBe(true);
  });

  it('enabling a channel revokes nothing', async () => {
    await broadcast(english.id, 'english', 'speaker-a', english.speakerCode);

    await patch(`/admin/channels/${english.id}`, { enabled: true });

    expect(isOnline(eventId, english.id)).toBe(true);
    expect(evictedSockets()).toEqual([]);
  });

  it('renaming a channel revokes nothing', async () => {
    await broadcast(english.id, 'english', 'speaker-a', english.speakerCode);

    await patch(`/admin/channels/${english.id}`, { name: 'English (simultaneous)' });

    expect(isOnline(eventId, english.id)).toBe(true);
    expect(evictedSockets()).toEqual([]);
  });

  it('deleting closes that channel’s producer and evicts its speaker', async () => {
    await broadcast(english.id, 'english', 'speaker-a', english.speakerCode);

    const res = await api.request(`/admin/channels/${english.id}`, { method: 'DELETE' });

    expect(res.status).toBe(204);
    expect(isOnline(eventId, english.id)).toBe(false);
    expect(evictedSockets()).toEqual(['speaker-a']);
  });

  it('an action on a channel with no producer succeeds and changes nothing', async () => {
    const res = await patch(`/admin/channels/${english.id}`, { enabled: false });

    expect(res.status).toBe(200);
    expect(published).toEqual([]);
  });
});

describe('regenerating a PIN', () => {
  /**
   * The case that forces the event-scoped variant: those listeners may hold no media at
   * all, so enumerating known peers would silently miss exactly who the regeneration is
   * meant to lock out.
   */
  it('publishes one room eviction rather than one per known peer', async () => {
    await broadcast(english.id, 'english', 'speaker-a', english.speakerCode);

    const res = await api.request(`/admin/events/${eventId}/regenerate-pin`, { method: 'POST' });

    expect(res.status).toBe(200);
    expect(roomEvictions()).toEqual([{ type: 'room-evicted', eventId, reason: 'access_revoked' }]);
    expect(evictedSockets()).toEqual([]);
  });

  it('closes every producer on the event and releases every claim', async () => {
    await broadcast(english.id, 'english', 'speaker-a', english.speakerCode);
    await broadcast(spanish.id, 'spanish', 'speaker-b', 'code-spanish');

    await api.request(`/admin/events/${eventId}/regenerate-pin`, { method: 'POST' });

    expect(isOnline(eventId, english.id)).toBe(false);
    expect(isOnline(eventId, spanish.id)).toBe(false);
    expect(presence.holder(english.id)).toBeUndefined();
    expect(presence.holder(spanish.id)).toBeUndefined();
  });

  it('publishes even when nobody was live, because listeners still hold the old PIN', async () => {
    await api.request(`/admin/events/${eventId}/regenerate-pin`, { method: 'POST' });

    expect(roomEvictions()).toHaveLength(1);
  });
});

describe('disabling and deleting an event', () => {
  it('disabling closes every producer on it', async () => {
    await broadcast(english.id, 'english', 'speaker-a', english.speakerCode);
    await broadcast(spanish.id, 'spanish', 'speaker-b', 'code-spanish');

    await patch(`/admin/events/${eventId}`, { enabled: false });

    expect(isOnline(eventId, english.id)).toBe(false);
    expect(isOnline(eventId, spanish.id)).toBe(false);
    expect(roomEvictions()).toHaveLength(1);
  });

  it('enabling an event revokes nothing', async () => {
    await broadcast(english.id, 'english', 'speaker-a', english.speakerCode);

    await patch(`/admin/events/${eventId}`, { enabled: true });

    expect(isOnline(eventId, english.id)).toBe(true);
    expect(roomEvictions()).toEqual([]);
    expect(evictedSockets()).toEqual([]);
  });

  it('deleting closes the room and evicts everyone on it', async () => {
    await broadcast(english.id, 'english', 'speaker-a', english.speakerCode);

    const res = await api.request(`/admin/events/${eventId}`, { method: 'DELETE' });

    expect(res.status).toBe(204);
    expect(isOnline(eventId, english.id)).toBe(false);
    expect(presence.holder(english.id)).toBeUndefined();
    expect(roomEvictions()).toHaveLength(1);
  });

  it('leaves another event’s audio alone', async () => {
    const other = createEvent(db, { name: 'Conference', enabled: true });
    const french = createChannel(db, other.id, { slug: 'french', name: 'French', enabled: true });
    await goLive({
      eventId: other.id,
      socketId: 'speaker-c',
      channelId: french.id,
      slug: 'french',
    });
    await broadcast(english.id, 'english', 'speaker-a', english.speakerCode);

    await patch(`/admin/events/${eventId}`, { enabled: false });

    expect(isOnline(other.id, french.id)).toBe(true);
  });
});
