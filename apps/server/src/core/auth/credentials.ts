import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { env } from '../../env';

export interface StoredAccount {
  username: string;
  passwordHash: string;
}

/**
 * A sibling of the database, because that directory is the one the operator already
 * mounts — which is what makes "delete the file and restart" a thing they can do from a
 * file manager. No environment variable of its own, for the same reason.
 */
export function credentialsPath(): string {
  return join(dirname(env.DATABASE_PATH), 'admin.json');
}

/**
 * Null when the file is absent — an unconfigured server. Anything else that fails to yield
 * a whole account throws: reading a damaged file as "unconfigured" would silently re-open
 * the account-claim window after a disk glitch.
 */
export function readCredentials(path: string): StoredAccount | null {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw new Error(`Cannot read the admin credential file at ${path}`, { cause });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new Error(`The admin credential file at ${path} is not valid JSON`, { cause });
  }

  const account = parsed as Partial<StoredAccount> | null;
  if (
    typeof account !== 'object' ||
    account === null ||
    Array.isArray(account) ||
    typeof account.username !== 'string' ||
    account.username.length === 0 ||
    typeof account.passwordHash !== 'string' ||
    account.passwordHash.length === 0
  ) {
    throw new Error(`The admin credential file at ${path} does not hold a complete account`);
  }

  return { username: account.username, passwordHash: account.passwordHash };
}

/**
 * Written to a sibling temporary file and renamed over the target, so a NAS losing power
 * mid-write leaves the old file rather than a half-written one indistinguishable from
 * corruption. 0600 keeps the hash no more readable than the database beside it.
 */
export function writeCredentials(path: string, account: StoredAccount): void {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(account, null, 2)}\n`, { mode: 0o600 });
  renameSync(temp, path);
}
