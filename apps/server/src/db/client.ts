import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

/**
 * Opens a SQLite database at `path`, creating its directory if needed, and returns
 * a Drizzle instance bound to the full schema. No module-level side effects: the
 * singleton in `./index` and the test helper in `./testing` both go through here.
 */
export function createDb(path: string) {
  // SQLite creates the file but never its parent directory, and data/ is gitignored.
  mkdirSync(dirname(path), { recursive: true });

  const sqlite = new Database(path);
  // None of these four is a SQLite default. WAL: readers do not block the writer.
  // foreign_keys: off by default and per-connection, so constraints are inert
  // without it. busy_timeout: a concurrent write fails instantly with SQLITE_BUSY
  // otherwise. synchronous=NORMAL: safe alongside WAL and substantially faster.
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');
  sqlite.pragma('synchronous = NORMAL');

  return drizzle(sqlite, { schema });
}

export type Db = ReturnType<typeof createDb>;
