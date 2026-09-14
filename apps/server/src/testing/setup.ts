import { vi } from 'vitest';

// Production scrypt cost takes hundreds of milliseconds per hash on a CI runner, so any test
// signing in a dozen times races Vitest's timeout. Hashes are self-describing, so a cheap
// cost exercises the same code; password.test.ts checks the real cost explicitly.
vi.mock('../core/auth/password-cost', () => ({
  PASSWORD_COST: { n: 1024, r: 8, p: 1 },
}));
