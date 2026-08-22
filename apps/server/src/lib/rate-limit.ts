interface Bucket {
  tokens: number;
  updatedAt: number;
}

/**
 * A per-key token bucket. Throttles, never bans: two hundred people in one room share
 * one NAT address, so a hard block punishes the room and the scanner alike. `now` is
 * injectable because the refill is otherwise only testable by sleeping.
 */
export class TokenBucketLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly capacity: number;
  private readonly refillPerSecond: number;
  private readonly now: () => number;
  private readonly maxKeys: number;

  constructor(opts: {
    capacity: number;
    refillPerSecond: number;
    now?: () => number;
    maxKeys?: number;
  }) {
    this.capacity = opts.capacity;
    this.refillPerSecond = opts.refillPerSecond;
    this.now = opts.now ?? Date.now;
    this.maxKeys = opts.maxKeys ?? 10_000;
  }

  get size(): number {
    return this.buckets.size;
  }

  /** Whether the key has a token; does not consume one, only `penalize` does. */
  allow(key: string): boolean {
    return (this.refill(key)?.tokens ?? this.capacity) >= 1;
  }

  /** Charges the key one token. Called only for a failed lookup. */
  penalize(key: string): void {
    const now = this.now();
    const existing = this.refill(key, now);
    if (existing) {
      existing.tokens = Math.max(0, existing.tokens - 1);
      return;
    }

    if (this.buckets.size >= this.maxKeys) {
      this.prune(now);
    }
    this.buckets.set(key, { tokens: Math.max(0, this.capacity - 1), updatedAt: now });
  }

  /** Returns a token charged by `penalize`, never taking a bucket past its capacity. */
  refund(key: string): void {
    const bucket = this.refill(key);
    if (!bucket) {
      return;
    }
    bucket.tokens = Math.min(this.capacity, bucket.tokens + 1);
    if (bucket.tokens >= this.capacity) {
      this.buckets.delete(key);
    }
  }

  /** Whole seconds until the key has a token again; 0 when it already does. */
  retryAfter(key: string): number {
    const bucket = this.refill(key);
    if (!bucket) {
      return 0;
    }
    if (bucket.tokens >= 1) {
      return 0;
    }
    return Math.max(1, Math.ceil((1 - bucket.tokens) / this.refillPerSecond));
  }

  private refill(key: string, now: number = this.now()): Bucket | undefined {
    const existing = this.buckets.get(key);
    if (!existing) {
      return undefined;
    }

    existing.tokens = this.tokensAt(existing, now);
    existing.updatedAt = now;
    if (existing.tokens < this.capacity) {
      return existing;
    }

    this.buckets.delete(key);
    return undefined;
  }

  private tokensAt(bucket: Bucket, now: number): number {
    const elapsedSeconds = (now - bucket.updatedAt) / 1000;
    return Math.min(this.capacity, bucket.tokens + elapsedSeconds * this.refillPerSecond);
  }

  /**
   * A refilled bucket is indistinguishable from an absent one. If every tracked address
   * still carries a penalty, evict the least recently touched state: preserving every
   * penalty would let a distributed guesser turn the limiter itself into an unbounded map.
   */
  private prune(now: number): void {
    for (const [key, bucket] of this.buckets) {
      if (this.tokensAt(bucket, now) >= this.capacity) {
        this.buckets.delete(key);
      }
    }

    while (this.buckets.size >= this.maxKeys) {
      let oldest: string | undefined;
      let oldestUpdate = Number.POSITIVE_INFINITY;
      for (const [key, bucket] of this.buckets) {
        if (bucket.updatedAt < oldestUpdate) {
          oldest = key;
          oldestUpdate = bucket.updatedAt;
        }
      }
      if (oldest === undefined) {
        break;
      }
      this.buckets.delete(oldest);
    }
  }
}
