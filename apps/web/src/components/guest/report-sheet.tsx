import { reportLabel, reportRows, type SentMap, selfCheck } from '@linguacast/client-core/channel';
import type { ReportCategory } from '@linguacast/contract/socket';
import { Check, MessageCircleWarning } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MICRO_LABEL } from '@/components/micro-label';
import { ResponsiveSurface } from '@/components/responsive-surface';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Fast enough that `Sent 30s ago` is never a second behind what the listener sees. */
const TICK_MS = 1_000;

type Stage = { kind: 'list' } | { kind: 'sent'; category: ReportCategory };
type ReportStage = Stage | { kind: 'resolved' };

export function ReportSheet({
  muted,
  live,
  sent,
  reportOpen,
  onSend,
  onResolve,
}: {
  /** Socket-authoritative; null while it is still unknown. */
  muted: boolean | null;
  live: boolean;
  /** Owned by the room, so closing and reopening the surface keeps the disable. */
  sent: SentMap;
  /** This connection has reported since its last positive confirmation. */
  reportOpen: boolean;
  onSend: (category: ReportCategory) => Promise<{ ok: true } | { ok: false; message: string }>;
  onResolve: () => Promise<{ ok: true } | { ok: false; message: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<ReportStage>({ kind: 'list' });
  const [pending, setPending] = useState<ReportCategory | null>(null);
  const [failed, setFailed] = useState<{ category: ReportCategory; message: string } | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveFailed, setResolveFailed] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const confirmation = useRef<HTMLParagraphElement | null>(null);
  const firstCategory = useRef<HTMLButtonElement | null>(null);
  const resolutionButton = useRef<HTMLButtonElement | null>(null);
  const hasOpenReport = reportOpen;

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
    if (stage.kind !== 'list') {
      confirmation.current?.focus();
    } else if (hasOpenReport) {
      resolutionButton.current?.focus();
    } else {
      firstCategory.current?.focus();
    }
  }, [stage, hasOpenReport]);

  const send = useCallback(
    async (category: ReportCategory) => {
      setPending(category);
      setFailed(null);
      setResolveFailed(null);
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

  const resolve = useCallback(async () => {
    setResolving(true);
    setFailed(null);
    setResolveFailed(null);
    try {
      const result = await onResolve();
      if (result.ok) {
        setStage({ kind: 'resolved' });
        return;
      }
      setResolveFailed(result.message);
    } catch {
      setResolveFailed('Could not send. Try again.');
    } finally {
      setResolving(false);
    }
  }, [onResolve]);

  const rows = reportRows({ sent, pending, failed, live, now });
  const check = selfCheck({ muted, live });
  const firstEnabled = rows.find((row) => !row.disabled)?.key;

  return (
    <ResponsiveSurface
      title={
        stage.kind === 'list' ? (hasOpenReport ? 'Update report' : 'Report a problem') : 'Sent'
      }
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setStage({ kind: 'list' });
          setFailed(null);
          setResolveFailed(null);
          setPending(null);
          setResolving(false);
        }
      }}
      triggerClassName="hover:overlay flex h-13 w-full cursor-pointer items-center justify-center gap-2.5 rounded-full bg-secondary text-base font-semibold text-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
      trigger={
        <>
          <MessageCircleWarning aria-hidden className="size-4.5" />
          Report a problem
        </>
      }
    >
      {stage.kind !== 'list' ? (
        <div className="flex flex-col items-center px-1.5 pt-0.5 pb-1.5 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-live-muted text-live-on-muted">
            <Check className="size-5 stroke-[2.25]" />
          </span>
          {/* Focused on arrival, so the stage swap does not drop focus to the body. */}
          <p ref={confirmation} tabIndex={-1} className="mt-4 text-section outline-none">
            {stage.kind === 'sent'
              ? `Sent — “${reportLabel(stage.category)}”.`
              : 'Sent — “Audio sounds good now”.'}
          </p>
          <p className="mt-2 max-w-72.5 text-note text-muted-foreground">
            {stage.kind === 'sent'
              ? 'Reports are anonymous and counted together with other listeners’. They clear after five minutes, and nothing comes back to you.'
              : 'The interpreter sees your confirmation without learning who sent it.'}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2.5">
            <Button
              variant="outline"
              size="action"
              onClick={() => setStage({ kind: 'list' })}
              className="rounded-full"
            >
              {stage.kind === 'sent' ? 'Update report' : 'Report a problem'}
            </Button>
            <Button size="action" onClick={() => setOpen(false)} className="rounded-full">
              Back to listening
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <div className="rounded-lg bg-check-surface px-4 pt-3.5 pb-3.75">
            <span className={cn(MICRO_LABEL, 'block')}>Check first</span>
            <div className="mt-2.75 flex items-baseline justify-between gap-3">
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

          {hasOpenReport ? (
            <div className="mt-5">
              <span className={cn(MICRO_LABEL, 'mb-2.5 block')}>Is it fixed?</span>
              <button
                ref={resolutionButton}
                type="button"
                disabled={!live || resolving || pending !== null}
                onClick={() => void resolve()}
                className="hover:overlay flex min-h-touch w-full cursor-pointer items-center justify-between gap-3 rounded-full border border-live/35 bg-live-muted px-4.5 text-left font-semibold text-sm text-live-on-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
              >
                <span className="flex items-center gap-2">
                  <Check className="size-4 stroke-[2.5]" />
                  Audio sounds good now
                </span>
                <span className="text-meta font-medium text-muted-foreground">
                  {resolving ? 'Sending…' : ''}
                </span>
              </button>
              {resolveFailed ? (
                <p className="mt-2 text-note text-destructive">{resolveFailed}</p>
              ) : null}
            </div>
          ) : null}

          <span className={cn(MICRO_LABEL, 'mt-5 mb-2.5 block')}>
            {hasOpenReport ? 'Still having a problem?' : 'What is wrong'}
          </span>
          <div className="flex flex-col gap-2">
            {rows.map((row) => (
              <button
                key={row.key}
                type="button"
                ref={row.key === firstEnabled ? firstCategory : undefined}
                disabled={row.disabled || resolving}
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
