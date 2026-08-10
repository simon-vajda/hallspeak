import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDb } from './client';

describe('createDb', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'linguacast-client-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  // SQLite creates files, never intermediate directories, and data/ is gitignored —
  // so without the mkdirSync this fails on every fresh clone and nowhere else.
  it('creates a parent directory that does not exist yet', () => {
    const path = join(dir, 'nested', 'app.db');

    const db = createDb(path);

    expect(existsSync(path)).toBe(true);
    db.$client.close();
  });

  // Per-connection, off by default, and silently inert when dropped: constraints
  // stop being enforced with no error anywhere. Hence a tripwire rather than trust.
  it('enables foreign key enforcement', () => {
    const db = createDb(join(dir, 'app.db'));

    expect(db.$client.pragma('foreign_keys', { simple: true })).toBe(1);
    db.$client.close();
  });

  it('uses WAL journalling', () => {
    const db = createDb(join(dir, 'app.db'));

    expect(db.$client.pragma('journal_mode', { simple: true })).toBe('wal');
    db.$client.close();
  });
});
