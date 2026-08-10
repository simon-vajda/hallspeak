import path from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Db } from './client';

/** Applies every pending migration. Idempotent — already-applied ones are skipped. */
export function runMigrations(db: Db): void {
  // The migrator reads .sql files from disk at runtime and tsdown bundles JavaScript
  // only, so this resolves relative to the bundle, the way env.ts resolves WEB_ROOT.
  // Under tsx that is src/db/migrations; in dist/index.js it is dist/migrations,
  // which scripts/copy-migrations.mjs fills.
  migrate(db, { migrationsFolder: path.join(import.meta.dirname, 'migrations') });
}
