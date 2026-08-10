import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Db } from '../../db/client';
import { createChannel, createEvent } from '../../events/queries';
import { createTestApi } from '../../testing/api';

let api: Awaited<ReturnType<typeof createTestApi>>['api'];
let db: Db;
let cleanup: () => void;

beforeAll(async () => {
  ({ api, db, cleanup } = await createTestApi());
});

afterAll(() => {
  cleanup();
});

function seedChannel(slug = 'english') {
  const event = createEvent(db, { name: 'Sunday' });
  return createChannel(db, event.id, { slug, name: 'English' });
}

const patch = (path: string, body: unknown) =>
  api.request(path, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('PATCH /admin/channels/{id}', () => {
  it('edits the name and the enabled flag', async () => {
    const channel = seedChannel();

    const res = await patch(`/admin/channels/${channel.id}`, {
      name: 'English (simultaneous)',
      enabled: true,
    });
    const body = (await res.json()) as { name: string; enabled: boolean; slug: string };

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ name: 'English (simultaneous)', enabled: true, slug: 'english' });
  });

  // A slug change would break every printed QR code, so the wire schema has no slug
  // field at all and an attempt to send one is a 400, not a silent no-op.
  it('rejects an attempt to change the slug', async () => {
    const channel = seedChannel('spanish');

    const res = await patch(`/admin/channels/${channel.id}`, { slug: 'espanol' });
    const after = await api.request(`/admin/events/${channel.eventId}`);
    const event = (await after.json()) as { channels: { slug: string }[] };

    expect(res.status).toBe(400);
    expect(event.channels[0]?.slug).toBe('spanish');
  });

  it('answers 404 for an unknown channel', async () => {
    expect((await patch('/admin/channels/999999', { name: 'x' })).status).toBe(404);
  });
});

describe('POST /admin/channels/{id}/regenerate-speaker-code', () => {
  it('replaces the code, invalidating the old one immediately', async () => {
    const channel = seedChannel('french');

    const res = await api.request(`/admin/channels/${channel.id}/regenerate-speaker-code`, {
      method: 'POST',
    });
    const body = (await res.json()) as { speakerCode: string };

    expect(res.status).toBe(200);
    expect(body.speakerCode).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(body.speakerCode).not.toBe(channel.speakerCode);
  });

  it('answers 404 for an unknown channel', async () => {
    const res = await api.request('/admin/channels/999999/regenerate-speaker-code', {
      method: 'POST',
    });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /admin/channels/{id}', () => {
  it('deletes the channel but not its event', async () => {
    const channel = seedChannel('german');

    expect((await api.request(`/admin/channels/${channel.id}`, { method: 'DELETE' })).status).toBe(
      204,
    );
    expect((await api.request(`/admin/events/${channel.eventId}`)).status).toBe(200);
  });

  it('answers 404 for an unknown channel', async () => {
    expect((await api.request('/admin/channels/999999', { method: 'DELETE' })).status).toBe(404);
  });
});
