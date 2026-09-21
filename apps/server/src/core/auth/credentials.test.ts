import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readCredentials, writeCredentials } from './credentials';

let dir: string;
let file: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hallspeak-credentials-'));
  file = join(dir, 'admin.json');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('readCredentials', () => {
  it('reports nothing for a file that is not there', () => {
    expect(readCredentials(file)).toBeNull();
  });

  it('round-trips what writeCredentials wrote', () => {
    writeCredentials(file, { username: 'admin', passwordHash: 'scrypt$1$2$3$c2FsdA$a2V5' });

    expect(readCredentials(file)).toEqual({
      username: 'admin',
      passwordHash: 'scrypt$1$2$3$c2FsdA$a2V5',
    });
  });

  it('throws naming the file when the JSON is malformed', () => {
    writeFileSync(file, '{ not json');

    expect(() => readCredentials(file)).toThrow(file);
  });

  it.each([
    ['no password hash', { username: 'admin' }],
    ['no username', { passwordHash: 'scrypt$1$2$3$c2FsdA$a2V5' }],
    ['a non-string field', { username: 'admin', passwordHash: 42 }],
    ['an empty username', { username: '', passwordHash: 'scrypt$1$2$3$c2FsdA$a2V5' }],
    ['an array', []],
  ])('throws naming the file for a partial account (%s)', (_name, value) => {
    writeFileSync(file, JSON.stringify(value));

    expect(() => readCredentials(file)).toThrow(file);
  });
});

describe('writeCredentials', () => {
  it('creates the directory when it does not exist yet', () => {
    const nested = join(dir, 'data', 'admin.json');

    writeCredentials(nested, { username: 'admin', passwordHash: 'hash' });

    expect(readCredentials(nested)).toEqual({ username: 'admin', passwordHash: 'hash' });
  });

  it('keeps the hash off group and other', () => {
    writeCredentials(file, { username: 'admin', passwordHash: 'hash' });

    expect(statSync(file).mode & 0o077).toBe(0);
  });

  it('leaves no temporary file behind', () => {
    writeCredentials(file, { username: 'admin', passwordHash: 'hash' });

    expect(readdirSync(dir)).toEqual(['admin.json']);
  });

  it('replaces an existing account rather than appending to it', () => {
    writeCredentials(file, { username: 'first', passwordHash: 'one' });
    writeCredentials(file, { username: 'second', passwordHash: 'two' });

    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({
      username: 'second',
      passwordHash: 'two',
    });
  });
});
