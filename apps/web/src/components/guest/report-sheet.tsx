import type { ReportCategory } from '@linguacast/contract/socket';
import { Check } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MICRO_LABEL } from '@/components/micro-label';
import { ResponsiveSurface } from '@/components/responsive-surface';
import { Button } from '@/components/ui/button';
import { reportLabel } from '@/lib/reports';
import { cn } from '@/lib/utils';
import { reportRows, type SentMap, selfCheck } from './report-state';

/** Fast enough that `Sent 30s ago` is never a second behind what the listener sees. */
const TICK_MS = 1_000;

type Stage = { kind: 'list' } | { kind: 'sent'; category: ReportCategory };

export function ReportSheet({
  volume,
  muted,
  live,
  sent,
  onSend,
}: {
  /** The listener's own volume, 0-100. */
  volume: number;
  /** Socket-authoritative; null while it is still unknown. */
  muted: boolean | null;
  live: boolean;
  /** Owned by the room, so closing and reopening the surface keeps the disable. */
  sent: SentMap;
  onSend: (category: ReportCategory) => Promise<{ ok: true } | { ok: false; message: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>({ kind: 'list' });
  const [pending, setPending] = useState<ReportCategory | null>(null);
  const [failed, setFailed] = useState<{ category: ReportCategory; message: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const confirmation = useRef<HTMLParagraphElement | null>(null);
  const firstCategory = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    // Read the clock on the way in too: the stored one is as old as the last time the
    // surface was open, which would print a stale `Sent Ns ago` for a second.
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [open]);

  // The stage swap moves focus explicitly, or the dialog drops it to the document body.
  useEffect(() => {
    if (stage.kind === 'sent') {
      confirmation.current?.focus();
    } else {
      firstCategory.current?.focus();
    }
  }, [stage]);

  const send = useCallback(
    async (category: ReportCategory) => {
      setPending(category);
      setFailed(null);
      try {
        const result = await onSend(category);
        if (result.ok) {
          setStage({ kind: 'sent', category });
          return;
        }
        setFailed({ category, message: result.message });
      } catch {
        // The ack has its own deadline and rejects when it passes. Without this the pending
        // state would never clear and every category would stay inert for good.
        setFailed({ category, message: 'Could not send. Try again.' });
      } finally {
        setPending(null);
      }
    },
    [onSend],
  );

  const rows = reportRows({ sent, pending, failed, live, now });
  const check = selfCheck({ volume, muted, live });
  const firstEnabled = rows.find((row) => !row.disabled)?.key;

  return (
    <ResponsiveSurface
      title={stage.kind === 'sent' ? 'Report sent' : 'Report a problem'}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setStage({ kind: 'list' });
          setFailed(null);
          setPending(null);
        }
      }}
      triggerClassName="rounded-full text-note font-semibold text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
      trigger="Report a problem"
    >
      {stage.kind === 'sent' ? (
        <div className="flex flex-col items-center px-1.5 pt-0.5 pb-1.5 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-live-muted text-live-on-muted">
            <Check className="size-5 stroke-[2.25]" />
          </span>
          {/* Focused on arrival, so the stage swap does not drop focus to the body. */}
          <p ref={confirmation} tabIndex={-1} className="mt-4 text-section outline-none">
            Sent — “{reportLabel(stage.category)}”.
          </p>
          <p className="mt-2 max-w-72.5 text-note text-muted-foreground">
            Reports are anonymous and counted together with other listeners’. They clear after five
            minutes, and nothing comes back to you.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2.5">
            <Button
              variant="outline"
              size="action"
              onClick={() => setStage({ kind: 'list' })}
              className="rounded-full"
            >
              Report something else
            </Button>
            <Button size="action" onClick={() => setOpen(false)} className="rounded-full">
              Back to listening
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <div className="rounded-lg bg-secondary px-4 pt-3.5 pb-3.75">
            <span className={cn(MICRO_LABEL, 'block')}>Check first</span>
            <div className="mt-2.75 flex items-baseline justify-between gap-3">
              <span className="text-sm leading-normal">Your volume</span>
              <span
                className={cn(
                  'font-mono font-semibold text-sm',
                  check.volumeWarn ? 'text-warn-on-muted' : 'text-foreground',
                )}
              >
                {check.volumeLabel}
              </span>
            </div>
            <div className="mt-2.25 flex items-baseline justify-between gap-3 border-border border-t pt-2.25">
              <span className="text-sm leading-normal">The interpreter</span>
              <span
                className={cn(
                  'font-semibold text-sm',
                  check.interpreterWarn ? 'text-warn-on-muted' : 'text-foreground',
                )}
              >
                {check.interpreterLabel}
                {check.interpreterKnown ? null : <span className="sr-only">Not known</span>}
              </span>
            </div>
          </div>

          <span className={cn(MICRO_LABEL, 'mt-5 mb-2.5 block')}>What is wrong</span>
          <div className="flex flex-col gap-2">
            {rows.map((row) => (
              <button
                key={row.key}
                type="button"
                ref={row.key === firstEnabled ? firstCategory : undefined}
                disabled={row.disabled}
                onClick={() => void send(row.key)}
                className="hover:overlay-strong flex min-h-touch w-full cursor-pointer items-center justify-between gap-3 rounded-full border border-border px-4.5 text-left font-semibold text-sm disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
              >
                <span>{row.label}</span>
                <span className="whitespace-nowrap text-meta font-medium text-muted-foreground">
                  {row.note}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-3.5 text-note text-muted-foreground">
            {live
              ? 'Nothing identifies you, and the interpreter sees a count rather than a message.'
              : 'Nobody is broadcasting on this channel right now, so there is nobody to tell.'}
          </p>
        </div>
      )}
    </ResponsiveSurface>
  );
}
