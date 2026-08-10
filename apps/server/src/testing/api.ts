import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * The API sub-app, wired to a throwaway migrated database.
 *
 * The env var MUST be set before the dynamic imports below: env.ts parses process.env
 * at module load and db/index.ts opens a file at module scope, so a static import here
 * would provision ./data/linguacast.db as a side effect of running the tests. Vitest
 * gives each test file its own module registry, so one call per file is enough — a
 * second call in the same file returns the same singleton, pointed at the first
 * temp directory.
 */
export async function createTestApi() {
  const dir = mkdtempSync(join(tmpdir(), 'linguacast-api-'));
  process.env.DATABASE_PATH = join(dir, 'test.db');

  const { closeDb, db } = await import('../db');
  const { runMigrations } = await import('../db/migrate');
  runMigrations(db);
  const { apiRoutes } = await import('../routes');

  return {
    api: apiRoutes,
    db,
    cleanup: () => {
      closeDb();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
