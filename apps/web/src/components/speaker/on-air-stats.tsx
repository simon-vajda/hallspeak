import { useEffect, useState } from 'react';
import { MICRO_LABEL } from '@/components/micro-label';
import { formatElapsed } from '@/lib/format';
import { cn } from '@/lib/utils';

const TICK_MS = 1000;

/**
 * A listener is a guest holding an open, unpaused consumer, so the count is structurally
 * zero before the interpreter goes live — which is why this pair only exists on air. The
 * tile is not gated on `live`: a muted interpreter still has listeners, and dropping it
 * would move the grid.
 */
export function OnAirStats({
  startedAt,
  listeners,
  className,
}: {
  /** `Date.now()` when the interpreter went live; null renders zero. */
  startedAt: number | null;
  /** Guests currently receiving this channel's audio. */
  listeners: number;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  // A wall-clock read, not an accumulating counter: a sleeping phone stops firing timers.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={cn('grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4', className)}>
      <div className="rounded-lg bg-secondary px-4.5 py-4 lg:px-5.5 lg:py-4.5">
        <div className="text-[32px] leading-none font-semibold tracking-[-0.045em] lg:text-[36px]">
          {formatElapsed(startedAt === null ? 0 : now - startedAt)}
        </div>
        <div className={cn('mt-1.25', MICRO_LABEL)}>On air</div>
      </div>

      <div className="rounded-lg bg-secondary px-4.5 py-4 lg:px-5.5 lg:py-4.5">
        <div className="text-[32px] leading-none font-semibold tracking-[-0.045em] lg:text-[36px]">
          {listeners}
        </div>
        <div className={cn('mt-1.25', MICRO_LABEL)}>Listeners</div>
      </div>
    </div>
  );
}
