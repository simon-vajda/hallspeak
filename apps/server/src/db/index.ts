import { env } from '../env';
import { createDb } from './client';

// Module-level singleton: handlers `import { db }`. Explicit injection from the
// composition root was considered and rejected as ceremony for a dependency that is
// genuinely process-wide — the one seam that matters, tests, is served by createDb.
//
// Importing this module opens a file and creates a directory. Anything that does not
// want the process-wide database must import ./client instead.
export const db = createDb(env.DATABASE_PATH);

export function closeDb(): void {
  db.$client.close();
}
