import {
  type AnchoredResolution,
  type AnchoredRow,
  reportAgeLabel,
  reportLabel,
  reportTone,
  sortReportRows,
} from '@linguacast/client-core/channel';
import { Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { MICRO_LABEL } from '@/components/micro-label';
import { cn } from '@/lib/utils';
import { reconcileReportRows, removeLeavingReportRows } from './report-row-presence';

/** The same five minutes the server keeps, so a row leaves without waiting for a publish. */
const WINDOW_MS = 5 * 60 * 1000;

/** Positive follow-up only acknowledges a recent fix; it is not ongoing channel state. */
const RESOLUTION_WINDOW_MS = 30 * 1000;

const TICK_MS = 1_000;

/** Matches report-in and report-out in index.css. */
const TRANSITION_MS = 260;

/** Matches report-row-in and report-row-out in index.css. */
const ROW_TRANSITION_MS = 200;

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
  resolution,
  known,
  className,
}: {
  rows: AnchoredRow[];
  resolution: AnchoredResolution | null;
  /** False until the connect-time tally lands: `No reports` is a claim a dropped socket
   * cannot support, so the panel withholds instead. */
  known: boolean;
  className?: string;
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
  const liveResolution =
    resolution !== null && now - resolution.receivedAt < RESOLUTION_WINDOW_MS ? resolution : null;
  const issueTotal = sorted.length === 0 ? 0 : live.reduce((sum, r) => sum + r.count, 0);
  const flash = useFlashParity(issueTotal, liveResolution?.receivedAt ?? null);
  const visible = !known || sorted.length > 0 || liveResolution !== null;
  const presence = usePanelPresence(visible);
  const presentRows = useReportRowPresence(sorted);

  // Absent while empty — but never while withholding, which would make a dropped socket look
  // like an empty window.
  if (presence === 'hidden') {
    return null;
  }

  return (
    <div className={cn('grid', visible ? 'animate-report-in' : 'animate-report-out', className)}>
      <div className="min-h-0 overflow-hidden">
        <section
          className={cn(
            'rounded-lg bg-secondary p-5',
            // Flash stays on the panel while the entrance lives on its wrapper. Keeping them on
            // separate elements prevents the first flash from cancelling the entrance.
            flash === 1 && 'animate-report-flash-a',
            flash === 2 && 'animate-report-flash-b',
          )}
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 className={MICRO_LABEL}>Listener reports</h2>
            <span className="text-meta font-medium text-muted-foreground">Recent feedback</span>
          </div>
          <div className="mt-3.5 flex flex-col gap-1.5" aria-live="polite">
            {liveResolution ? (
              <div className="grid animate-report-row-in">
                <div className="min-h-0 overflow-hidden">
                  <div className="flex items-center justify-between gap-3 rounded-md border border-live/35 bg-live-muted py-2.75 pr-3 pl-3.5 text-live-on-muted">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Check className="size-4.5 shrink-0 stroke-[2.5]" />
                      <span>
                        <span className="block font-semibold text-sm">Audio sounds good now</span>
                        <span className="mt-0.5 block text-meta font-medium text-muted-foreground">
                          {reportAgeLabel(now - liveResolution.receivedAt)}
                        </span>
                      </span>
                    </span>
                    <span className="flex h-6.5 min-w-6.5 items-center justify-center rounded-full bg-live/20 px-2 text-note font-semibold">
                      {liveResolution.count}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
            {presentRows.map(({ row, phase }) => {
              const tone = reportTone(row.category);
              return (
                <div
                  key={row.category}
                  aria-hidden={phase === 'leaving'}
                  className={cn(
                    'grid',
                    phase === 'leaving' ? 'animate-report-row-out' : 'animate-report-row-in',
                  )}
                >
                  <div className="min-h-0 overflow-hidden">
                    <div
                      className={cn(
                        'flex items-center justify-between gap-3 rounded-md border py-2.75 pr-3 pl-3.5',
                        TONE[tone],
                      )}
                    >
                      <span>
                        <span className="block font-semibold text-sm">
                          {reportLabel(row.category)}
                        </span>
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
                  </div>
                </div>
              );
            })}
            {presentRows.length === 0 && liveResolution === null && !known ? (
              <p className="rounded-md border border-border border-dashed px-3.5 py-4 text-note text-muted-foreground">
                <span aria-hidden>—</span>
                <span className="sr-only">Status unknown</span>
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

/** Retains removed categories until their keyed exit animations finish. */
function useReportRowPresence(rows: ReturnType<typeof sortReportRows>) {
  const [presentRows, setPresentRows] = useState(() => reconcileReportRows([], rows));

  useEffect(() => {
    setPresentRows((current) => reconcileReportRows(current, rows));
  }, [rows]);

  const leavingKey = presentRows
    .filter((row) => row.phase === 'leaving')
    .map((row) => row.row.category)
    .join(':');

  useEffect(() => {
    if (!leavingKey) {
      return;
    }
    const timer = setTimeout(
      () => setPresentRows((current) => removeLeavingReportRows(current)),
      ROW_TRANSITION_MS,
    );
    return () => clearTimeout(timer);
  }, [leavingKey]);

  return presentRows;
}

/** Keeps the panel mounted long enough for its exit animation to finish. */
function usePanelPresence(visible: boolean): 'hidden' | 'visible' | 'leaving' {
  const [presence, setPresence] = useState<'hidden' | 'visible' | 'leaving'>(() =>
    visible ? 'visible' : 'hidden',
  );

  useEffect(() => {
    if (visible) {
      setPresence('visible');
      return;
    }

    setPresence((current) => (current === 'hidden' ? current : 'leaving'));
    const timer = setTimeout(() => setPresence('hidden'), TRANSITION_MS);
    return () => clearTimeout(timer);
  }, [visible]);

  return presence;
}

/**
 * Two identical keyframes alternating on a counter. Re-applying one animation name to a
 * mounted element does not replay it, so a single keyframe would flash the first report
 * and nothing after it.
 */
function useFlashParity(total: number, resolutionAt: number | null): 0 | 1 | 2 {
  const previous = useRef({ total, resolutionAt });
  const [parity, setParity] = useState<0 | 1 | 2>(0);

  useEffect(() => {
    if (
      total > previous.current.total ||
      (resolutionAt !== null && resolutionAt !== previous.current.resolutionAt)
    ) {
      setParity((current) => (current === 1 ? 2 : 1));
    }
    previous.current = { total, resolutionAt };
  }, [total, resolutionAt]);

  return parity;
}
