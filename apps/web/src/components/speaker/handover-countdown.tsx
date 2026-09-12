import { useEffect, useState } from 'react';
import { formatCountdown } from '@/lib/handover-copy';
import { cn } from '@/lib/utils';

const TICK_MS = 250;

/**
 * Milliseconds left against a deadline the socket layer already anchored to this client's
 * clock. Null while no deadline is in force, so a caller can tell "no countdown" from zero.
 *
 * Ticks faster than the second it renders: a one-second interval drifts against the
 * deadline and can leave the last whole second on screen for almost two.
 */
export function useHandoverRemaining(expiresAt: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (expiresAt === null) {
      return;
    }
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [expiresAt]);

  return expiresAt === null ? null : Math.max(0, expiresAt - now);
}

/**
 * Time alone, never permission: the server decides who may force a swap, and a client
 * clock reaching zero is not that answer.
 */
export function HandoverCountdown({
  remainingMs,
  className,
}: {
  remainingMs: number;
  className?: string;
}) {
  return (
    <span
      role="timer"
      aria-live="polite"
      className={cn('font-semibold text-sm tabular-nums', className)}
    >
      {formatCountdown(remainingMs)}
    </span>
  );
}
