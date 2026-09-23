import { useEffect, useState } from 'react';
import { MICRO_LABEL } from '@/components/micro-label';
import { Skeleton } from '@/components/ui/skeleton';
import { formatElapsed, STATUS_UNKNOWN } from '@/lib/format';
import { useSettledFlag, WITHHOLD_GRACE_MS } from '@/lib/use-settled-flag';
import { cn } from '@/lib/utils';
import { withheldReading } from '@/lib/withheld-reading';

const TICK_MS = 1000;

/**
 * A listener is a guest holding an open, unpaused consumer, so the count is structurally
 * zero before the interpreter goes live — which is why this pair only exists on air. The
 * tile is not gated on `live`: a muted interpreter still has listeners, and dropping it
 * would move the grid. An unknown count is withheld, never shown as zero.
 */
export function OnAirStats({
  startedAt,
  listeners,
  className,
}: {
  /** `Date.now()` when the interpreter went live; null renders zero. */
  startedAt: number | null;
  /** Guests currently receiving this channel's audio; undefined while no current report exists. */
  listeners: number | undefined;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  const settled = useSettledFlag(listeners === undefined, WITHHOLD_GRACE_MS);
  const reading = withheldReading(listeners, settled);

  // A wall-clock read, not an accumulating counter: a sleeping phone stops firing timers.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={cn('grid grid-cols-2 gap-3 lg:gap-4', className)}>
      <div className="rounded-lg bg-secondary px-4.5 py-4 lg:px-panel lg:py-4.5">
        <div className="text-stat lg:text-stat-lg">
          {formatElapsed(startedAt === null ? 0 : now - startedAt)}
        </div>
        <div className={cn('mt-1.25', MICRO_LABEL)}>On air</div>
      </div>

      <div className="rounded-lg bg-secondary px-4.5 py-4 lg:px-panel lg:py-4.5">
        <div className="text-stat lg:text-stat-lg">
          {reading === 'value' && listeners}
          {reading === 'pending' && (
            <Skeleton className="w-12 rounded-full">
              <span className="invisible">0</span>
              <span className="sr-only">{STATUS_UNKNOWN}</span>
            </Skeleton>
          )}
          {reading === 'withheld' && (
            <>
              <span aria-hidden>—</span>
              <span className="sr-only">{STATUS_UNKNOWN}</span>
            </>
          )}
        </div>
        <div className={cn('mt-1.25', MICRO_LABEL)}>Listeners</div>
      </div>
    </div>
  );
}
