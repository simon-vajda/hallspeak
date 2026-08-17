import { useEffect, useState } from 'react';
import { formatElapsed } from '@/lib/format';
import { cn } from '@/lib/utils';

const TICK_MS = 1000;

/**
 * The design draws a listener count beside the timer; nothing reports one yet. The grid is
 * written for the pair, so the count arrives as a second child and no layout moves.
 */
export function OnAirStats({
  startedAt,
  className,
}: {
  /** `Date.now()` when the interpreter went live; null renders zero. */
  startedAt: number | null;
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
        <div className="mt-1.25 text-label text-muted-foreground uppercase">On air</div>
      </div>
    </div>
  );
}
