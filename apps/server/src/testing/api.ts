import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * The API sub-app, wired to a throwaway migrated database. DATABASE_PATH must be set
 * before the dynamic imports below: env.ts parses process.env at module load and
 * db/index.ts opens a file at module scope, so a static import would provision
 * ./data/linguacast.db. One call per test file: a second returns the same singleton.
 */
export async function createTestApi() {
  const dir = mkdtempSync(join(tmpdir(), 'linguacast-api-'));
  process.env.DATABASE_PATH = join(dir, 'test.db');

  const { closeDb, db } = await import('../db');
  const { runMigrations } = await import('../db/migrate');
  runMigrations(db);
  const { resetAuth, startAuth } = await import('../core/auth');
  startAuth();
  const { apiRoutes } = await import('../http/routes');

  return {
    api: apiRoutes,
    db,
    cleanup: () => {
      resetAuth();
      closeDb();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
