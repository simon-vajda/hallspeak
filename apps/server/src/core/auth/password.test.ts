import { describe, expect, it } from 'vitest';
import {
  DUMMY_PASSWORD_HASH,
  hashesInFlight,
  hashPassword,
  MAX_CONCURRENT_HASHES,
  verifyPassword,
} from './password';

describe('hashPassword', () => {
  it('produces a hash its own password verifies against', async () => {
    const encoded = await hashPassword('correct horse battery staple');

    await expect(verifyPassword('correct horse battery staple', encoded)).resolves.toBe(true);
  });

  it('rejects a different password', async () => {
    const encoded = await hashPassword('correct horse battery staple');

    await expect(verifyPassword('correct horse battery stapl', encoded)).resolves.toBe(false);
  });

  it('salts every hash, so the same password encodes differently twice', async () => {
    const [a, b] = await Promise.all([
      hashPassword('same-password'),
      hashPassword('same-password'),
    ]);

    expect(a).not.toBe(b);
  });

  it('completes at the configured parameters without a maxmem error', async () => {
    await expect(hashPassword('parameters fit in maxmem')).resolves.toMatch(/^scrypt\$/);
  });
});

describe('verifyPassword', () => {
  it('reads the cost parameters from the stored string rather than from today constants', async () => {
    const cheap = await hashPassword('portable', { n: 1024, r: 8, p: 1 });

    expect(cheap).toContain('$1024$8$1$');
    await expect(verifyPassword('portable', cheap)).resolves.toBe(true);
    await expect(verifyPassword('other', cheap)).resolves.toBe(false);
  });

  it.each([
    ['empty', ''],
    ['not delimited', 'nonsense'],
    ['wrong algorithm', 'bcrypt$32768$8$3$c2FsdA$a2V5'],
    ['non-numeric cost', 'scrypt$x$8$3$c2FsdA$a2V5'],
    ['too few fields', 'scrypt$32768$8$3$c2FsdA'],
  ])('returns false for a malformed hash (%s) rather than throwing', async (_name, encoded) => {
    await expect(verifyPassword('anything', encoded)).resolves.toBe(false);
  });

  it('returns false for anything checked against the dummy hash', async () => {
    await expect(verifyPassword('', DUMMY_PASSWORD_HASH)).resolves.toBe(false);
    await expect(verifyPassword('admin', DUMMY_PASSWORD_HASH)).resolves.toBe(false);
  });
});

describe('the concurrency cap', () => {
  it('resolves every verification while never exceeding the cap in flight', async () => {
    const encoded = await hashPassword('bounded', { n: 1024, r: 8, p: 1 });

    let observed = 0;
    const watch = setInterval(() => {
      observed = Math.max(observed, hashesInFlight());
    }, 1);

    const results = await Promise.all(
      Array.from({ length: MAX_CONCURRENT_HASHES * 4 }, () => verifyPassword('bounded', encoded)),
    );
    clearInterval(watch);

    expect(results).toEqual(results.map(() => true));
    expect(observed).toBeLessThanOrEqual(MAX_CONCURRENT_HASHES);
  });
});
