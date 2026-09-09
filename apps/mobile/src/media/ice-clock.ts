/**
 * Which armed recovery deadlines have passed.
 *
 * Pure so it can be tested without a peer connection: the ladder itself needs one, but the
 * question of what is due at a given moment does not.
 */
export function dueDeadlines<K extends string, T extends { at: number }>(
  armed: Partial<Record<K, T>>,
  now: number,
): T[] {
  return Object.values(armed).filter((entry): entry is T => (entry as T).at <= now);
}

/**
 * A signalling round trip whose own deadline has stopped being serviced.
 *
 * Bounded generously: Socket.IO's ack timer is the first line, and this only fires where
 * that timer is not running at all, so a live-but-slow server must never trip it.
 */
export function stalledSteps<K extends string>(
  startedAt: Partial<Record<K, number>>,
  now: number,
  limit: number,
): number {
  return Object.values(startedAt).filter((at) => now - (at as number) >= limit).length;
}
