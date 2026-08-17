import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApi } from '../../../testing/api';

let api: Awaited<ReturnType<typeof createTestApi>>['api'];
let cleanup: () => void;

const post = (path: string, body?: unknown) =>
  api.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const patch = (path: string, body: unknown) =>
  api.request(path, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

beforeAll(async () => {
  ({ api, cleanup } = await createTestApi());
});

afterAll(() => {
  cleanup();
});

describe('POST /admin/events', () => {
  it('creates a disabled event with a pin and no channels', async () => {
    const res = await post('/admin/events', { name: 'Sunday Service' });
    const body = (await res.json()) as {
      id: number;
      pin: string;
      enabled: boolean;
      description: string | null;
      channels: unknown[];
    };

    expect(res.status).toBe(201);
    expect(body.pin).toMatch(/^\d{6}$/);
    expect(body.enabled).toBe(false);
    expect(body.description).toBe(null);
    expect(body.channels).toEqual([]);
  });

  it('rejects an empty name with 400', async () => {
    expect((await post('/admin/events', { name: '' })).status).toBe(400);
  });
});

describe('GET /admin/events', () => {
  type ListedEvent = {
    id: number;
    name: string;
    enabled: boolean;
    channels: { slug: string; enabled: boolean }[];
  };

  const list = async () => {
    const res = await api.request('/admin/events');
    expect(res.status).toBe(200);
    return (await res.json()) as ListedEvent[];
  };

  it('includes disabled events, unlike the public route', async () => {
    await post('/admin/events', { name: 'Hidden Conference' });

    expect((await list()).some((e) => e.name === 'Hidden Conference' && !e.enabled)).toBe(true);
  });

  it('carries each event with its own channels, disabled ones included', async () => {
    const withChannels = (await (
      await post('/admin/events', { name: 'Listed With Channels' })
    ).json()) as { id: number };
    const bare = (await (await post('/admin/events', { name: 'Listed Bare' })).json()) as {
      id: number;
    };

    await post(`/admin/events/${withChannels.id}/channels`, { slug: 'english', name: 'English' });
    await post(`/admin/events/${withChannels.id}/channels`, {
      slug: 'spanish',
      name: 'Spanish',
      enabled: true,
    });

    const body = await list();
    const listed = body.find((e) => e.id === withChannels.id);
    const listedBare = body.find((e) => e.id === bare.id);

    expect(listed?.channels.map((c) => c.slug).sort()).toEqual(['english', 'spanish']);
    expect(listed?.channels.some((c) => !c.enabled)).toBe(true);
    // An event without channels carries the key regardless: the client maps over it.
    expect(listedBare?.channels).toEqual([]);
  });
});

describe('GET|PATCH|DELETE /admin/events/{id}', () => {
  it('round-trips an edit', async () => {
    const created = (await (await post('/admin/events', { name: 'Draft' })).json()) as {
      id: number;
    };

    const res = await patch(`/admin/events/${created.id}`, { name: 'Renamed', enabled: true });
    const body = (await res.json()) as { name: string; enabled: boolean };

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ name: 'Renamed', enabled: true });
  });

  it('answers 404 for an unknown id on every verb', async () => {
    expect((await api.request('/admin/events/999999')).status).toBe(404);
    expect((await patch('/admin/events/999999', { name: 'x' })).status).toBe(404);
    expect((await api.request('/admin/events/999999', { method: 'DELETE' })).status).toBe(404);
    expect((await post('/admin/events/999999/regenerate-pin')).status).toBe(404);
  });

  it('rejects a non-numeric id with 400', async () => {
    expect((await api.request('/admin/events/abc')).status).toBe(400);
  });

  it('deletes an event and its channels together', async () => {
    const event = (await (await post('/admin/events', { name: 'Doomed' })).json()) as {
      id: number;
    };
    const channel = (await (
      await post(`/admin/events/${event.id}/channels`, { slug: 'english', name: 'English' })
    ).json()) as { id: number };

    expect((await api.request(`/admin/events/${event.id}`, { method: 'DELETE' })).status).toBe(204);
    expect((await api.request(`/admin/events/${event.id}`)).status).toBe(404);
    expect((await patch(`/admin/channels/${channel.id}`, { name: 'x' })).status).toBe(404);
  });
});

describe('POST /admin/events/{id}/regenerate-pin', () => {
  it('replaces the pin', async () => {
    const created = (await (await post('/admin/events', { name: 'Printed' })).json()) as {
      id: number;
      pin: string;
    };

    const res = await post(`/admin/events/${created.id}/regenerate-pin`);
    const body = (await res.json()) as { pin: string };

    expect(res.status).toBe(200);
    expect(body.pin).toMatch(/^\d{6}$/);
    expect(body.pin).not.toBe(created.pin);
  });
});

describe('POST /admin/events/{id}/channels', () => {
  it('creates a disabled channel with a speaker code', async () => {
    const event = (await (await post('/admin/events', { name: 'Conference' })).json()) as {
      id: number;
    };

    const res = await post(`/admin/events/${event.id}/channels`, {
      slug: 'english',
      name: 'English',
    });
    const body = (await res.json()) as { speakerCode: string; enabled: boolean; eventId: number };

    expect(res.status).toBe(201);
    expect(body.speakerCode).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(body.enabled).toBe(false);
    expect(body.eventId).toBe(event.id);
  });

  it('rejects a duplicate slug on the same event with 409', async () => {
    const event = (await (await post('/admin/events', { name: 'Dup' })).json()) as { id: number };
    await post(`/admin/events/${event.id}/channels`, { slug: 'english', name: 'English' });

    const res = await post(`/admin/events/${event.id}/channels`, {
      slug: 'english',
      name: 'English again',
    });

    expect(res.status).toBe(409);
  });

  it('rejects a slug that is not kebab-case with 400', async () => {
    const event = (await (await post('/admin/events', { name: 'Slugs' })).json()) as { id: number };

    expect(
      (await post(`/admin/events/${event.id}/channels`, { slug: 'English!', name: 'x' })).status,
    ).toBe(400);
  });

  it('answers 404 for a channel on an unknown event', async () => {
    expect(
      (await post('/admin/events/999999/channels', { slug: 'english', name: 'English' })).status,
    ).toBe(404);
  });
});
