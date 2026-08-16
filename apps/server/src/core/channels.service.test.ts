import { describe, expect, it } from 'vitest';
import { createTestDb } from '../db/testing';
import {
  createChannel,
  findEnabledChannelBySlug,
  findEnabledChannelBySpeakerCode,
  getChannelById,
  listChannels,
  listEnabledChannels,
  regenerateSpeakerCode,
  updateChannel,
} from './channels.service';
import { createEvent } from './events.service';

describe('public lookups', () => {
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
});
