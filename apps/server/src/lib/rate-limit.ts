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
    return this.refill(key).tokens >= 1;
  }

  /** Charges the key one token. Called only for a failed lookup. */
  penalize(key: string): void {
    const bucket = this.refill(key);
    bucket.tokens = Math.max(0, bucket.tokens - 1);
  }

  /** Returns a token charged by `penalize`, never taking a bucket past its capacity. */
  refund(key: string): void {
    const bucket = this.refill(key);
    bucket.tokens = Math.min(this.capacity, bucket.tokens + 1);
  }

  /** Whole seconds until the key has a token again; 0 when it already does. */
  retryAfter(key: string): number {
    const bucket = this.refill(key);
    if (bucket.tokens >= 1) return 0;
    return Math.max(1, Math.ceil((1 - bucket.tokens) / this.refillPerSecond));
  }

  private refill(key: string): Bucket {
    const now = this.now();
    const existing = this.buckets.get(key);
    if (existing) {
      const elapsedSeconds = (now - existing.updatedAt) / 1000;
      existing.tokens = Math.min(
        this.capacity,
        existing.tokens + elapsedSeconds * this.refillPerSecond,
      );
      existing.updatedAt = now;
      return existing;
    }

    if (this.buckets.size >= this.maxKeys) this.prune();
    const fresh: Bucket = { tokens: this.capacity, updatedAt: now };
    this.buckets.set(key, fresh);
    return fresh;
  }

  /** A full bucket is indistinguishable from an absent one, so dropping it loses nothing. */
  private prune(): void {
    for (const [key, bucket] of this.buckets) {
      if (bucket.tokens >= this.capacity) this.buckets.delete(key);
    }
  }
}
