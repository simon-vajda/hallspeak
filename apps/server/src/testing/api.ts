import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export type ApiRequest = (
  path: string,
  init?: RequestInit,
  env?: object,
) => Promise<Response> | Response;

/**
 * The API sub-app, wired to a throwaway migrated database and a throwaway credential file.
 * Every import below is dynamic and DATABASE_PATH is set before them: env.ts parses
 * process.env at module load and db/index.ts opens a file at module scope, so one static
 * import anywhere in a test file's graph provisions the real ./data/ instead. That is why
 * the auth handles a test needs are returned from here rather than imported directly.
 * One call per test file: a second returns the same singletons.
 */
export async function createTestApi() {
  const dir = mkdtempSync(join(tmpdir(), 'linguacast-api-'));
  process.env.DATABASE_PATH = join(dir, 'test.db');

  const { closeDb, db } = await import('../db');
  const { runMigrations } = await import('../db/migrate');
  runMigrations(db);
  const { createAccount, createSession, resetAuth, SESSION_TTL_MS, startAuth } = await import(
    '../core/auth'
  );
  // Explicit, never the env-derived default: credentialsPath() resolves against whatever
  // DATABASE_PATH env.ts happened to parse first, which is the real one if anything loaded
  // env before this function ran.
  startAuth(join(dir, 'admin.json'));
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
    /** `now` is injectable so a test can mint an already-expired session. */
    createSession: (now?: number): string => createSession(db, now),
    /** The in-process recovery: forget the account and delete its file. */
    resetAuth,
    SESSION_TTL_MS,
    cleanup: () => {
      resetAuth();
      closeDb();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
