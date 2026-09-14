import { randomBytes, type ScryptOptions, scrypt, timingSafeEqual } from 'node:crypto';
import { PASSWORD_COST, type ScryptCost } from './password-cost';

const SALT_BYTES = 16;
const KEY_BYTES = 32;

/**
 * scrypt throws rather than allocating past maxmem, whose default is 32 MB — exactly what
 * PASSWORD_COST needs. Derived from the stored cost, so raising N cannot silently
 * break verification of hashes written under the old one.
 */
function maxmem(cost: ScryptCost): number {
  return 128 * cost.n * cost.r + 128 * cost.r * cost.p + 1024 * 1024;
}

/**
 * Two derivations of 32 MB are tolerable on the smallest target box; twenty are not. The
 * cap makes a burst of sign-in attempts wait instead of failing, which is why sign-in
 * needs no shared global budget on top of its per-address one.
 */
export const MAX_CONCURRENT_HASHES = 3;

let inFlight = 0;
const waiting = new Set<() => void>();

/** Exposed so the cap is provable rather than asserted; nothing outside a test reads it. */
export function hashesInFlight(): number {
  return inFlight;
}

async function withSlot<T>(work: () => Promise<T>): Promise<T> {
  if (inFlight >= MAX_CONCURRENT_HASHES) {
    await new Promise<void>((resolve) => waiting.add(resolve));
  }
  inFlight += 1;
  try {
    return await work();
  } finally {
    inFlight -= 1;
    const next = waiting.values().next().value;
    if (next) {
      waiting.delete(next);
      next();
    }
  }
}

function scryptAsync(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_BYTES, options, (err, key) => {
      if (err) {
        reject(err);
      } else {
        resolve(key);
      }
    });
  });
}

function derive(password: string, salt: Buffer, cost: ScryptCost): Promise<Buffer> {
  return withSlot(() =>
    scryptAsync(password, salt, { N: cost.n, r: cost.r, p: cost.p, maxmem: maxmem(cost) }),
  );
}

/**
 * Self-describing: verification reads its parameters from the string, never from PASSWORD_COST, so
 * raising the cost later leaves every stored hash valid.
 */
export async function hashPassword(
  password: string,
  cost: ScryptCost = PASSWORD_COST,
): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt, cost);
  return [
    'scrypt',
    cost.n,
    cost.r,
    cost.p,
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join('$');
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split('$');
  if (parts.length !== 6) {
    return false;
  }

  const [algorithm, n = '', r = '', p = '', salt = '', key = ''] = parts;
  if (algorithm !== 'scrypt') {
    return false;
  }

  const cost = { n: Number(n), r: Number(r), p: Number(p) };
  if (!Number.isInteger(cost.n) || !Number.isInteger(cost.r) || !Number.isInteger(cost.p)) {
    return false;
  }

  const expected = Buffer.from(key, 'base64url');
  if (expected.length !== KEY_BYTES) {
    return false;
  }

  try {
    const actual = await derive(password, Buffer.from(salt, 'base64url'), cost);
    // Guarded above because timingSafeEqual throws on a length mismatch.
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/**
 * An unknown username is verified against this instead of returning early, so the response
 * time cannot say whether the username was right.
 */
export const DUMMY_PASSWORD_HASH = [
  'scrypt',
  PASSWORD_COST.n,
  PASSWORD_COST.r,
  PASSWORD_COST.p,
  randomBytes(SALT_BYTES).toString('base64url'),
  randomBytes(KEY_BYTES).toString('base64url'),
].join('$');
