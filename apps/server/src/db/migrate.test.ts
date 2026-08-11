import { describe, expect, it } from 'vitest';
import { events } from './schema';
import { createTestDb } from './testing';

describe('createTestDb', () => {
  // Exercises the whole loop: directory creation, the pragmas, migration discovery
  // from disk, and a write and read back through it.
  it('round-trips a row through the committed migrations', () => {
    const { db, cleanup } = createTestDb();

    try {
      const now = Date.now();
      db.insert(events)
        .values({ pin: '123456', name: 'Sunday', createdAt: now, updatedAt: now })
        .run();

      expect(db.select().from(events).all()).toHaveLength(1);
    } finally {
      cleanup();
    }
  });

  it('gives each call its own isolated database', () => {
    const first = createTestDb();
    const second = createTestDb();

    try {
      const now = Date.now();
      first.db
        .insert(events)
        .values({ pin: '123456', name: 'Sunday', createdAt: now, updatedAt: now })
        .run();

      expect(second.db.select().from(events).all()).toEqual([]);
    } finally {
      first.cleanup();
      second.cleanup();
    }
  });
});
