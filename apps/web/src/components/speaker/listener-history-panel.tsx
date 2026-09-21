import { type AnchoredListenerPoint, listenerChartRows } from '@hallspeak/client-core/channel';
import { lazy, Suspense, useEffect, useState } from 'react';
import { MICRO_LABEL } from '@/components/micro-label';
import { useSettledFlag, WITHHOLD_GRACE_MS } from '@/lib/use-settled-flag';
import { cn } from '@/lib/utils';
import {
  LISTENER_HISTORY_HEADING,
  listenerChartSummary,
  listenerPeak,
} from './listener-history-chart';

/**
 * Across a roughly 400px axis one pixel is about nine seconds, so the flat stretch the line
 * holds to the right edge gains nothing from a faster clock.
 */
const TICK_MS = 10_000;

const ListenerHistoryFigure = lazy(() => import('./listener-history-figure'));

export function ListenerHistoryPanel({
  history,
  className,
}: {
  /** Undefined until a snapshot arrives, and again once the socket drops: a series nobody
   * has sent is not a series of zeroes, so the chart is withheld rather than flattened. */
  history: AnchoredListenerPoint[] | undefined;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const rows = history === undefined ? [] : listenerChartRows(history, now);
  const settled = useSettledFlag(rows.length === 0, WITHHOLD_GRACE_MS);
  const summary = listenerChartSummary(rows);

  return (
    <section className={cn('rounded-lg bg-secondary p-5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={MICRO_LABEL}>{LISTENER_HISTORY_HEADING}</h2>
        {/* Always present, so gaining a series is a data change rather than a re-layout.
            The summary below carries the same two numbers to a screen reader. */}
        <span aria-hidden className="text-meta font-medium text-muted-foreground">
          Peak {rows.length === 0 ? '—' : listenerPeak(rows)}
        </span>
      </div>

      {/* The line carries nothing a screen reader can follow, so it is hidden and the
          sentence beside it carries the reading instead. */}
      <p className="sr-only">{summary}</p>

      {/* One height in every state: the withheld slot must not resize the panel list when
          the first snapshot lands, and neither may the figure's chunk arriving. */}
      <div className="mt-3.5 h-40">
        {rows.length === 0 ? (
          <WithheldSlot settled={settled} />
        ) : (
          <Suspense fallback={<WithheldSlot settled={false} />}>
            <ListenerHistoryFigure rows={rows} now={now} />
          </Suspense>
        )}
      </div>
    </section>
  );
}

function WithheldSlot({ settled }: { settled: boolean }) {
  return (
    <div className="flex h-full items-center justify-center rounded-md border border-border border-dashed text-note text-muted-foreground">
      <span aria-hidden>{settled ? '—' : null}</span>
    </div>
  );
}
