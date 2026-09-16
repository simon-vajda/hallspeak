import { useEffect, useState } from 'react';

/**
 * How long a studio panel withholds an unknown reading silently before it says so. The
 * reading is seeded moments after a go-live or reconnect, and a panel that says so and
 * takes it back inside that window moves every panel below it twice.
 */
export const WITHHOLD_GRACE_MS = 2_000;

/** `value` turning true takes effect after `delayMs`; turning false takes effect at once. */
export function useSettledFlag(value: boolean, delayMs: number): boolean {
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!value) {
      setSettled(false);
      return;
    }
    const timer = setTimeout(() => setSettled(true), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return settled;
}
