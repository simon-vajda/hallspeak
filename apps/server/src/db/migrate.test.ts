import { describe, expect, it } from 'vitest';
import { meta } from './schema';
import { createTestDb } from './testing';

describe('createTestDb', () => {
  // Exercises the whole loop the real tables will use: directory creation, the
  // pragmas, migration discovery from disk, and a write and read back through it.
  it('round-trips a row through the committed migrations', () => {
    const { db, cleanup } = createTestDb();

    try {
      db.insert(meta).values({ key: 'spec', value: 'D' }).run();

      expect(db.select().from(meta).all()).toEqual([{ key: 'spec', value: 'D' }]);
    } finally {
      cleanup();
    }
  });

  it('gives each call its own isolated database', () => {
    const first = createTestDb();
    const second = createTestDb();

    try {
      first.db.insert(meta).values({ key: 'spec', value: 'D' }).run();

      expect(second.db.select().from(meta).all()).toEqual([]);
    } finally {
      first.cleanup();
      second.cleanup();
    }
  });
});
