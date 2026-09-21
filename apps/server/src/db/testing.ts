import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDb, type Db } from './client';
import { runMigrations } from './migrate';

/**
 * A real, migrated, throwaway database in its own temp directory; call `cleanup()` when
 * done. Imports `createDb` from ./client, never ./index: loading the singleton would
 * provision ./data/hallspeak.db as a side effect of running the tests.
 */
export function createTestDb(): { db: Db; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'hallspeak-test-'));
  const db = createDb(join(dir, 'test.db'));
  runMigrations(db);

  return {
    db,
    cleanup: () => {
      db.$client.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
