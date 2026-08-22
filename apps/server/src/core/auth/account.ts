import { rmSync } from 'node:fs';
import { AppError } from '../../lib/problem';
import {
  credentialsPath,
  readCredentials,
  type StoredAccount,
  writeCredentials,
} from './credentials';
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from './password';

// A module singleton, reached by import like `db` and `core/media`, never injected.
let file: string | null = null;
let account: StoredAccount | null = null;
let claiming = false;

/**
 * Read once, at boot. A running server never re-reads the file, so recovery requires a
 * deliberate restart and can never surprise a live event. Throws on a file that exists but
 * cannot be read as a whole account: refusing to start is loud, and the fix is documented.
 */
export function startAuth(path: string = credentialsPath()): void {
  file = path;
  account = readCredentials(path);
  claiming = false;
}

/**
 * The recovery act — deleting the file and forgetting the account — performed in process.
 * The operator's version of it is a file manager and a restart; this exists so a test can
 * drive a server from configured back to unconfigured without one.
 */
export function resetAuth(): void {
  if (file) rmSync(file, { force: true });
  account = null;
  claiming = false;
}

export function isConfigured(): boolean {
  return account !== null;
}

/**
 * The claim is taken synchronously, before the hash it has to wait for: checking and then
 * writing asynchronously lets two setup requests in the same tick both pass the check.
 */
export async function createAccount(username: string, password: string): Promise<void> {
  if (!file) throw new AppError('auth_unavailable', 'Authentication is not available.');
  if (account || claiming) {
    throw new AppError('already_configured', 'This server already has an administrator.');
  }

  claiming = true;
  try {
    const created = { username, passwordHash: await hashPassword(password) };
    writeCredentials(file, created);
    account = created;
  } finally {
    claiming = false;
  }
}

/**
 * A wrong username still pays for a derivation against a hash nothing matches, so the
 * response time cannot say which half was wrong.
 */
export async function verifyCredentials(username: string, password: string): Promise<boolean> {
  const current = account;
  if (!current || current.username !== username) {
    await verifyPassword(password, DUMMY_PASSWORD_HASH);
    return false;
  }
  return verifyPassword(password, current.passwordHash);
}
