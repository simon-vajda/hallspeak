import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export type ApiRequest = (
  path: string,
  init?: RequestInit,
  env?: object,
) => Promise<Response> | Response;

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
  const { createAccount, createSession, resetAuth, startAuth } = await import('../core/auth');
  startAuth();
  const { apiRoutes } = await import('../http/routes');

  return {
    api: apiRoutes,
    db,
    /**
     * Creates the administrator and a session, and hands back a request function carrying
     * its cookie. Every admin route is behind `requireAdmin`, so a test that skips this
     * gets 401s rather than the handler it meant to exercise.
     */
    signInAsAdmin: async (): Promise<ApiRequest> => {
      await createAccount('admin', 'hunter2!');
      const cookie = `__Host-linguacast_session=${createSession(db)}`;
      return (path, init, env) =>
        apiRoutes.request(
          path,
          { ...init, headers: { ...(init?.headers as Record<string, string>), cookie } },
          env,
        );
    },
    cleanup: () => {
      resetAuth();
      closeDb();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
