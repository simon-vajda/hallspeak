import { describe, expect, it } from 'vitest';
import { createTestDb } from '../db/testing';
import {
  createChannel,
  createEvent,
  deleteEvent,
  findEnabledChannelBySlug,
  findEnabledChannelBySpeakerCode,
  findEnabledEventByPin,
  getChannelById,
  listChannels,
  listEnabledChannels,
  listEvents,
  regeneratePin,
  regenerateSpeakerCode,
  updateChannel,
  updateEvent,
} from './queries';

describe('createEvent', () => {
  it('starts disabled with a six-digit pin', () => {
    const { db, cleanup } = createTestDb();
    try {
      const event = createEvent(db, { name: 'Sunday Service' });

      expect(event.pin).toMatch(/^\d{6}$/);
      expect(event.enabled).toBe(false);
      expect(event.description).toBe(null);
    } finally {
      cleanup();
    }
  });

  // The retry is invisible in production and untestable without seeding the collision.
  it('retries past a pin collision', () => {
    const { db, cleanup } = createTestDb();
    try {
      createEvent(db, { name: 'First' }, () => '424242');
      const pins = ['424242', '424243'];
      let call = 0;

      const second = createEvent(db, { name: 'Second' }, () => pins[call++] ?? '000000');

      expect(second.pin).toBe('424243');
      expect(call).toBe(2);
    } finally {
      cleanup();
    }
  });
});

describe('public lookups', () => {
  it('does not find a disabled event', () => {
    const { db, cleanup } = createTestDb();
    try {
      const event = createEvent(db, { name: 'Sunday' });

      expect(findEnabledEventByPin(db, event.pin)).toBeUndefined();

      updateEvent(db, event.id, { enabled: true });

      expect(findEnabledEventByPin(db, event.pin)?.id).toBe(event.id);
    } finally {
      cleanup();
    }
  });

  it('lists only enabled channels', () => {
    const { db, cleanup } = createTestDb();
    try {
      const event = createEvent(db, { name: 'Sunday', enabled: true });
      const english = createChannel(db, event.id, {
        slug: 'english',
        name: 'English',
        enabled: true,
      });
      createChannel(db, event.id, { slug: 'spanish', name: 'Spanish' });

      expect(listEnabledChannels(db, event.id).map((c) => c.id)).toEqual([english.id]);
      expect(listChannels(db, event.id)).toHaveLength(2);
    } finally {
      cleanup();
    }
  });

  it('scopes a slug lookup to its own event', () => {
    const { db, cleanup } = createTestDb();
    try {
      const a = createEvent(db, { name: 'A', enabled: true });
      const b = createEvent(db, { name: 'B', enabled: true });
      createChannel(db, a.id, { slug: 'english', name: 'English', enabled: true });

      expect(findEnabledChannelBySlug(db, a.id, 'english')).toBeDefined();
      expect(findEnabledChannelBySlug(db, b.id, 'english')).toBeUndefined();
    } finally {
      cleanup();
    }
  });

  it('does not resolve a speaker code for a disabled channel', () => {
    const { db, cleanup } = createTestDb();
    try {
      const event = createEvent(db, { name: 'Sunday', enabled: true });
      const channel = createChannel(db, event.id, { slug: 'english', name: 'English' });

      expect(findEnabledChannelBySpeakerCode(db, channel.speakerCode)).toBeUndefined();

      updateChannel(db, channel.id, { enabled: true });

      expect(findEnabledChannelBySpeakerCode(db, channel.speakerCode)?.id).toBe(channel.id);
    } finally {
      cleanup();
    }
  });
});

describe('mutations', () => {
  it('regenerates a pin, invalidating the old one', () => {
    const { db, cleanup } = createTestDb();
    try {
      const event = createEvent(db, { name: 'Sunday', enabled: true });
      const oldPin = event.pin;

      const updated = regeneratePin(db, event.id);

      expect(updated?.pin).not.toBe(oldPin);
      expect(findEnabledEventByPin(db, oldPin)).toBeUndefined();
      expect(findEnabledEventByPin(db, updated?.pin ?? '')?.id).toBe(event.id);
    } finally {
      cleanup();
    }
  });

  it('regenerates a speaker code, invalidating the old one', () => {
    const { db, cleanup } = createTestDb();
    try {
      const event = createEvent(db, { name: 'Sunday', enabled: true });
      const channel = createChannel(db, event.id, {
        slug: 'english',
        name: 'English',
        enabled: true,
      });
      const oldCode = channel.speakerCode;

      const updated = regenerateSpeakerCode(db, channel.id);

      expect(updated?.speakerCode).not.toBe(oldCode);
      expect(findEnabledChannelBySpeakerCode(db, oldCode)).toBeUndefined();
    } finally {
      cleanup();
    }
  });

  it('never changes a slug', () => {
    const { db, cleanup } = createTestDb();
    try {
      const event = createEvent(db, { name: 'Sunday' });
      const channel = createChannel(db, event.id, { slug: 'english', name: 'English' });

      updateChannel(db, channel.id, { name: 'English (simultaneous)' });

      expect(getChannelById(db, channel.id)?.slug).toBe('english');
      expect(getChannelById(db, channel.id)?.name).toBe('English (simultaneous)');
    } finally {
      cleanup();
    }
  });

  it('bumps updatedAt on a patch', () => {
    const { db, cleanup } = createTestDb();
    try {
      const event = createEvent(db, { name: 'Sunday' });
      db.$client.exec(`UPDATE events SET updated_at = 0 WHERE id = ${event.id}`);

      const updated = updateEvent(db, event.id, { name: 'Sunday Service' });

      expect(updated?.updatedAt).toBeGreaterThan(0);
    } finally {
      cleanup();
    }
  });

  it('reports a missing row rather than throwing', () => {
    const { db, cleanup } = createTestDb();
    try {
      expect(updateEvent(db, 999, { name: 'x' })).toBeUndefined();
      expect(deleteEvent(db, 999)).toBe(false);
      expect(listEvents(db)).toEqual([]);
    } finally {
      cleanup();
    }
  });
});
