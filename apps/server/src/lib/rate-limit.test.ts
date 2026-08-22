import { describe, expect, it } from 'vitest';
import { TokenBucketLimiter } from './rate-limit';

function fixedClock(start = 0) {
  let now = start;
  return { now: () => now, advance: (ms: number) => (now += ms) };
}

describe('TokenBucketLimiter', () => {
  it('admits the whole burst before throttling', () => {
    const clock = fixedClock();
    const limiter = new TokenBucketLimiter({ capacity: 3, refillPerSecond: 1, now: clock.now });

    for (let i = 0; i < 3; i++) {
      expect(limiter.allow('ip')).toBe(true);
      limiter.penalize('ip');
    }

    expect(limiter.allow('ip')).toBe(false);
  });

  it('refills over time', () => {
    const clock = fixedClock();
    const limiter = new TokenBucketLimiter({ capacity: 3, refillPerSecond: 1, now: clock.now });
    for (let i = 0; i < 3; i++) {
      limiter.penalize('ip');
    }

    expect(limiter.allow('ip')).toBe(false);

    clock.advance(1_000);

    expect(limiter.allow('ip')).toBe(true);
  });

  it('never refills past its capacity', () => {
    const clock = fixedClock();
    const limiter = new TokenBucketLimiter({ capacity: 3, refillPerSecond: 1, now: clock.now });
    limiter.penalize('ip');
    clock.advance(60_000);

    for (let i = 0; i < 3; i++) {
      expect(limiter.allow('ip')).toBe(true);
      limiter.penalize('ip');
    }

    expect(limiter.allow('ip')).toBe(false);
  });

  it('reports a whole-second Retry-After, at least 1', () => {
    const clock = fixedClock();
    const limiter = new TokenBucketLimiter({ capacity: 1, refillPerSecond: 1, now: clock.now });

    expect(limiter.retryAfter('ip')).toBe(0);

    limiter.penalize('ip');

    expect(limiter.retryAfter('ip')).toBe(1);
  });

  it('keys buckets independently', () => {
    const clock = fixedClock();
    const limiter = new TokenBucketLimiter({ capacity: 1, refillPerSecond: 1, now: clock.now });
    limiter.penalize('a');

    expect(limiter.allow('a')).toBe(false);
    expect(limiter.allow('b')).toBe(true);
  });

  it('does not retain no-op state for successful addresses', () => {
    const limiter = new TokenBucketLimiter({ capacity: 2, refillPerSecond: 1 });

    for (let i = 0; i < 20; i++) {
      limiter.allow(`ip-${i}`);
    }

    expect(limiter.size).toBe(0);
  });

  // Unbounded growth is the obvious way an in-memory limiter becomes the outage.
  it('prunes full buckets once maxKeys is reached', () => {
    const clock = fixedClock();
    const limiter = new TokenBucketLimiter({
      capacity: 2,
      refillPerSecond: 1,
      now: clock.now,
      maxKeys: 4,
    });
    limiter.penalize('keeps-state');
    for (let i = 0; i < 20; i++) {
      limiter.allow(`ip-${i}`);
    }

    expect(limiter.size).toBeLessThanOrEqual(4);
    // The one bucket that carries state survives pruning.
    expect(limiter.allow('keeps-state')).toBe(true);
    limiter.penalize('keeps-state');
    expect(limiter.allow('keeps-state')).toBe(false);
  });

  it('stays bounded when every tracked key still carries a penalty', () => {
    const clock = fixedClock();
    const limiter = new TokenBucketLimiter({
      capacity: 2,
      refillPerSecond: 1,
      now: clock.now,
      maxKeys: 4,
    });

    for (let i = 0; i < 20; i++) {
      limiter.penalize(`ip-${i}`);
    }

    expect(limiter.size).toBeLessThanOrEqual(4);
  });
});
