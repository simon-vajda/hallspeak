import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAccount, isConfigured, resetAuth, startAuth, verifyCredentials } from './account';
import { readCredentials, writeCredentials } from './credentials';
import { hashPassword } from './password';

let dir: string;
let file: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'linguacast-account-'));
  file = join(dir, 'admin.json');
});

afterEach(() => {
  resetAuth();
  rmSync(dir, { recursive: true, force: true });
});

describe('startAuth', () => {
  it('boots unconfigured when no file is there', () => {
    startAuth(file);

    expect(isConfigured()).toBe(false);
  });

  it('boots configured from a well-formed file', async () => {
    writeCredentials(file, { username: 'admin', passwordHash: await hashPassword('hunter2!') });

    startAuth(file);

    expect(isConfigured()).toBe(true);
    await expect(verifyCredentials('admin', 'hunter2!')).resolves.toBe(true);
  });

  it('finds the account again after a restart', async () => {
    startAuth(file);
    await createAccount('admin', 'hunter2!');

    startAuth(file);

    expect(isConfigured()).toBe(true);
    await expect(verifyCredentials('admin', 'hunter2!')).resolves.toBe(true);
  });

  it('throws naming the file when it cannot be parsed', () => {
    writeFileSync(file, '{ half written');

    expect(() => startAuth(file)).toThrow(file);
  });

  it('throws naming the file when the account is partial', () => {
    writeFileSync(file, JSON.stringify({ username: 'admin' }));

    expect(() => startAuth(file)).toThrow(file);
  });
});

describe('createAccount', () => {
  it('writes a file that parses back into the same account', async () => {
    startAuth(file);

    await createAccount('admin', 'hunter2!');

    const stored = readCredentials(file);
    expect(stored?.username).toBe('admin');
    expect(stored?.passwordHash).not.toContain('hunter2!');
    expect(isConfigured()).toBe(true);
  });

  it('refuses once an account exists and leaves the stored one alone', async () => {
    startAuth(file);
    await createAccount('admin', 'hunter2!');

    await expect(createAccount('intruder', 'letmein1!')).rejects.toThrow();

    expect(readCredentials(file)?.username).toBe('admin');
  });

  it('produces exactly one account from two concurrent calls', async () => {
    startAuth(file);

    const results = await Promise.allSettled([
      createAccount('first', 'hunter2!'),
      createAccount('second', 'hunter3!'),
    ]);

    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected']);
    expect(readCredentials(file)?.username).toBe('first');
  });
});

describe('verifyCredentials', () => {
  it('accepts the right pair and rejects either half being wrong', async () => {
    startAuth(file);
    await createAccount('admin', 'hunter2!');

    await expect(verifyCredentials('admin', 'hunter2!')).resolves.toBe(true);
    await expect(verifyCredentials('admin', 'hunter3!')).resolves.toBe(false);
    await expect(verifyCredentials('root', 'hunter2!')).resolves.toBe(false);
  });

  it('is false on an unconfigured server', async () => {
    startAuth(file);

    await expect(verifyCredentials('admin', 'hunter2!')).resolves.toBe(false);
  });
});

describe('resetAuth', () => {
  it('returns a configured module to the unconfigured state', async () => {
    startAuth(file);
    await createAccount('admin', 'hunter2!');

    resetAuth();

    expect(isConfigured()).toBe(false);
    expect(existsSync(file)).toBe(false);
  });
});
