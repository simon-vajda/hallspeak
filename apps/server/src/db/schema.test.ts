import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { adminSessions, channels, events } from './schema';
import { createTestDb } from './testing';

function seedEvent(db: ReturnType<typeof createTestDb>['db'], pin: string) {
  const now = Date.now();
  return db
    .insert(events)
    .values({ pin, name: 'Sunday Service', createdAt: now, updatedAt: now })
    .returning()
    .get();
}

function seedChannel(
  db: ReturnType<typeof createTestDb>['db'],
  eventId: number,
  slug: string,
  speakerCode: string,
) {
  const now = Date.now();
  return db
    .insert(channels)
    .values({ eventId, slug, name: slug, speakerCode, createdAt: now, updatedAt: now })
    .returning()
    .get();
}

describe('schema', () => {
  it('rejects a duplicate slug within one event', () => {
    const { db, cleanup } = createTestDb();
    try {
      const event = seedEvent(db, '100001');
      seedChannel(db, event.id, 'english', 'code-a');

      expect(() => seedChannel(db, event.id, 'english', 'code-b')).toThrow();
    } finally {
      cleanup();
    }
  });

  it('allows the same slug on two different events', () => {
    const { db, cleanup } = createTestDb();
    try {
      const first = seedEvent(db, '100002');
      const second = seedEvent(db, '100003');
      seedChannel(db, first.id, 'english', 'code-c');

      expect(() => seedChannel(db, second.id, 'english', 'code-d')).not.toThrow();
    } finally {
      cleanup();
    }
  });

  it('rejects a duplicate speaker code across events', () => {
    const { db, cleanup } = createTestDb();
    try {
      const first = seedEvent(db, '100004');
      const second = seedEvent(db, '100005');
      seedChannel(db, first.id, 'english', 'shared-code');

      expect(() => seedChannel(db, second.id, 'english', 'shared-code')).toThrow();
    } finally {
      cleanup();
    }
  });

  // Relies on the foreign_keys pragma, which is per-connection and inert unless set.
  it('cascades a delete of an event to its channels', () => {
    const { db, cleanup } = createTestDb();
    try {
      const event = seedEvent(db, '100006');
      seedChannel(db, event.id, 'english', 'code-e');

      db.delete(events).where(eq(events.id, event.id)).run();

      expect(db.select().from(channels).all()).toEqual([]);
    } finally {
      cleanup();
    }
  });

  it('defaults a new event and channel to disabled', () => {
    const { db, cleanup } = createTestDb();
    try {
      const event = seedEvent(db, '100007');
      const channel = seedChannel(db, event.id, 'english', 'code-f');

      expect(event.enabled).toBe(false);
      expect(channel.enabled).toBe(false);
    } finally {
      cleanup();
    }
  });
});

describe('admin_sessions', () => {
  it('rejects a second row for the same token hash', () => {
    const { db, cleanup } = createTestDb();
    try {
      const now = Date.now();
      const row = { tokenHash: 'abc', createdAt: now, expiresAt: now + 1000 };
      db.insert(adminSessions).values(row).run();

      expect(() => db.insert(adminSessions).values(row).run()).toThrow();
    } finally {
      cleanup();
    }
  });
});
