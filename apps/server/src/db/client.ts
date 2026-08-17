import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

/**
 * Opens a SQLite database at `path` and binds Drizzle to the full schema. Must stay free
 * of module-level side effects: `./index` and `./testing` both go through here.
 */
export function createDb(path: string) {
  // SQLite creates the file but never its parent directory, and data/ is gitignored.
  mkdirSync(dirname(path), { recursive: true });

  const sqlite = new Database(path);
  // None of these four is a default. foreign_keys is per-connection: without it the
  // constraints are inert. Without busy_timeout a concurrent write fails on SQLITE_BUSY.
  // synchronous=NORMAL is safe only alongside WAL, which also keeps readers off the writer.
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');
  sqlite.pragma('synchronous = NORMAL');

  return drizzle(sqlite, { schema });
}

export type Db = ReturnType<typeof createDb>;
