import path from 'node:path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { Db } from './client';

/** Applies every pending migration. Idempotent: already-applied ones are skipped. */
export function runMigrations(db: Db): void {
  // The migrator reads .sql from disk at runtime and tsdown bundles JavaScript only, so
  // this resolves against the bundle: src/db/migrations under tsx, dist/migrations in the
  // build, which scripts/copy-migrations.mjs fills.
  migrate(db, { migrationsFolder: path.join(import.meta.dirname, 'migrations') });
}
