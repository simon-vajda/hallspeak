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

  // Without mkdirSync this fails on a fresh clone and nowhere else: data/ is gitignored.
  it('creates a parent directory that does not exist yet', () => {
    const path = join(dir, 'nested', 'app.db');

    const db = createDb(path);

    expect(existsSync(path)).toBe(true);
    db.$client.close();
  });

  // Per-connection and off by default: dropped, the constraints go inert with no error.
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
