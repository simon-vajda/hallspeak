import { useEffect, useRef, useState } from 'react';
import { MICRO_LABEL } from '@/components/micro-label';
import {
  type AnchoredRow,
  reportAgeLabel,
  reportLabel,
  reportTone,
  sortReportRows,
} from '@/lib/reports';
import { cn } from '@/lib/utils';

/** The same five minutes the server keeps, so a row leaves without waiting for a publish. */
const WINDOW_MS = 5 * 60 * 1000;

const TICK_MS = 1_000;

const TONE = {
  warn: 'border-warn-border bg-warn-muted text-warn-on-muted',
  severe: 'border-destructive-border bg-destructive-muted text-destructive',
} as const;

const CHIP = {
  warn: 'bg-warn/26 text-warn-on-muted',
  severe: 'bg-destructive/18 text-destructive',
} as const;

export function ListenerReports({
  rows,
  known,
  className,
  variant = 'panel',
}: {
  rows: AnchoredRow[];
  /** False until the connect-time tally lands: `No reports` is a claim a dropped socket
   * cannot support, so the panel withholds instead. */
  known: boolean;
  className?: string;
  /** `phone` hides the panel while it has nothing to say, so it costs no fold height. */
  variant?: 'panel' | 'phone';
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const live = rows.filter((row) => now - row.receivedAt < WINDOW_MS);
  const sorted = sortReportRows(
    live.map((row) => ({
      category: row.category,
      count: row.count,
      ageMs: now - row.receivedAt,
    })),
  );
  const flash = useFlashParity(sorted.length === 0 ? 0 : live.reduce((sum, r) => sum + r.count, 0));

  // The phone panel is absent while empty — but never while withholding, which would make a
  // dropped socket look like an empty window.
  if (variant === 'phone' && known && sorted.length === 0) {
    return null;
  }

  return (
    <section
      className={cn(
        'rounded-lg bg-secondary p-5',
        // The panel arrives on the phone rather than appearing, and flashes on every later
        // report. One element carries one `animation`, so the entrance is the mount frame
        // and the alternating flash takes over from the first arrival after it.
        variant === 'phone' && flash === 0 && 'animate-report-in',
        flash === 1 && 'animate-report-flash-a',
        flash === 2 && 'animate-report-flash-b',
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className={MICRO_LABEL}>Listener reports</h2>
        <span className="text-meta font-medium text-muted-foreground">Last five minutes</span>
      </div>
      <div className="mt-3.5 flex flex-col gap-1.5" aria-live="polite">
        {sorted.map((row) => {
          const tone = reportTone(row.category);
          return (
            <div
              key={row.category}
              className={cn(
                'flex items-center justify-between gap-3 rounded-md border py-2.75 pr-3 pl-3.5',
                TONE[tone],
              )}
            >
              <span>
                <span className="block font-semibold text-sm">{reportLabel(row.category)}</span>
                <span className="mt-0.5 block text-meta font-medium text-muted-foreground">
                  {reportAgeLabel(row.ageMs)}
                </span>
              </span>
              <span
                className={cn(
                  'flex h-6.5 min-w-6.5 items-center justify-center rounded-full px-2 text-note font-semibold',
                  CHIP[tone],
                )}
              >
                {row.count}
              </span>
            </div>
          );
        })}
        {sorted.length === 0 ? (
          <p className="rounded-md border border-border border-dashed px-3.5 py-4 text-note text-muted-foreground">
            {known ? (
              'No reports. Listeners can flag an audio problem from their page, and it appears here for five minutes.'
            ) : (
              <>
                <span aria-hidden>—</span>
                <span className="sr-only">Status unknown</span>
              </>
            )}
          </p>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Two identical keyframes alternating on a counter. Re-applying one animation name to a
 * mounted element does not replay it, so a single keyframe would flash the first report
 * and nothing after it.
 */
function useFlashParity(total: number): 0 | 1 | 2 {
  const previous = useRef(total);
  const [parity, setParity] = useState<0 | 1 | 2>(0);

  useEffect(() => {
    if (total > previous.current) {
      setParity((current) => (current === 1 ? 2 : 1));
    }
    previous.current = total;
  }, [total]);

  return parity;
}
