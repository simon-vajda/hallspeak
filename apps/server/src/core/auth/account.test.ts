import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  changePassword,
  createAccount,
  currentUsername,
  isConfigured,
  resetAuth,
  startAuth,
  verifyCredentials,
} from './account';
import { readCredentials, writeCredentials } from './credentials';
import { hashPassword, verifyPassword } from './password';

// Passes through to the real derivation; a test that needs to hold one open overrides a call.
vi.mock('./password', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./password')>();
  return { ...actual, verifyPassword: vi.fn(actual.verifyPassword) };
});

let dir: string;
let file: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hallspeak-account-'));
  file = join(dir, 'admin.json');
});

afterEach(() => {
  chmodSync(dir, 0o700);
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

describe('changePassword', () => {
  it('replaces the password, and the old one stops verifying', async () => {
    startAuth(file);
    await createAccount('admin', 'hunter2!');

    await expect(changePassword('hunter2!', 'correct1!')).resolves.toBe('changed');

    await expect(verifyCredentials('admin', 'correct1!')).resolves.toBe(true);
    await expect(verifyCredentials('admin', 'hunter2!')).resolves.toBe(false);
  });

  it('survives a restart', async () => {
    startAuth(file);
    await createAccount('admin', 'hunter2!');
    await changePassword('hunter2!', 'correct1!');

    startAuth(file);

    await expect(verifyCredentials('admin', 'correct1!')).resolves.toBe(true);
    expect(currentUsername()).toBe('admin');
  });

  it('refuses a wrong current password and leaves the file byte-identical', async () => {
    startAuth(file);
    await createAccount('admin', 'hunter2!');
    const before = readFileSync(file, 'utf8');

    await expect(changePassword('hunter3!', 'correct1!')).resolves.toBe('refused');

    expect(readFileSync(file, 'utf8')).toBe(before);
    await expect(verifyCredentials('admin', 'hunter2!')).resolves.toBe(true);
  });

  it('accepts the current password as the new one', async () => {
    startAuth(file);
    await createAccount('admin', 'hunter2!');

    await expect(changePassword('hunter2!', 'hunter2!')).resolves.toBe('changed');

    await expect(verifyCredentials('admin', 'hunter2!')).resolves.toBe(true);
  });

  it('refuses a second change while the first is still hashing, then admits the next', async () => {
    startAuth(file);
    await createAccount('admin', 'hunter2!');

    const first = changePassword('hunter2!', 'correct1!');
    await expect(changePassword('hunter2!', 'other1!x')).resolves.toBe('in_progress');
    await expect(first).resolves.toBe('changed');

    await expect(changePassword('correct1!', 'other1!x')).resolves.toBe('changed');
  });

  it('keeps the old password when the file cannot be written, and releases the claim', async () => {
    startAuth(file);
    await createAccount('admin', 'hunter2!');
    chmodSync(dir, 0o500);

    await expect(changePassword('hunter2!', 'correct1!')).rejects.toThrow();

    chmodSync(dir, 0o700);
    await expect(verifyCredentials('admin', 'hunter2!')).resolves.toBe(true);
    await expect(changePassword('hunter2!', 'correct1!')).resolves.toBe('changed');
  });

  it('refuses on an unconfigured server', async () => {
    startAuth(file);

    await expect(changePassword('hunter2!', 'correct1!')).resolves.toBe('refused');
  });

  it('refuses a sign-in whose derivation was still running when the password changed', async () => {
    startAuth(file);
    await createAccount('admin', 'hunter2!');
    const real = vi.mocked(verifyPassword).getMockImplementation();
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.mocked(verifyPassword).mockImplementationOnce(async (password, encoded) => {
      await held;
      return real ? real(password, encoded) : false;
    });

    const signIn = verifyCredentials('admin', 'hunter2!');
    await changePassword('hunter2!', 'correct1!');
    release();

    await expect(signIn).resolves.toBe(false);
  });
});

describe('currentUsername', () => {
  it('is undefined until an account exists', async () => {
    startAuth(file);
    expect(currentUsername()).toBeUndefined();

    await createAccount('admin', 'hunter2!');
    expect(currentUsername()).toBe('admin');
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
