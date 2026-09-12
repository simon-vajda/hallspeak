import { ArrowLeftRight } from 'lucide-react';
import { HandoverCountdown, useHandoverRemaining } from '@/components/speaker/handover-countdown';
import { Button } from '@/components/ui/button';
import {
  HAND_OVER,
  HANDING_OVER_NOTE,
  HANDING_OVER_TITLE,
  HANDOVER_FAILED,
  HANDOVER_REQUEST_TITLE,
  handoverRequestNote,
} from '@/lib/handover-copy';
import { cn } from '@/lib/utils';

/**
 * A row rather than a dialog: the interpreter is mid-sentence, and a modal would take the
 * mute target away from them to ask a question that can wait for a natural break.
 */
export function HandoverPrompt({
  handingOver,
  expiresAt,
  busy,
  failed,
  onHandOver,
  className,
}: {
  handingOver: boolean;
  expiresAt: number | null;
  busy: boolean;
  failed: boolean;
  onHandOver: () => void;
  className?: string;
}) {
  const remaining = useHandoverRemaining(handingOver ? null : expiresAt);

  return (
    <section
      aria-live="polite"
      className={cn(
        'flex gap-3.5 rounded-lg border p-4 sm:items-center sm:gap-4 sm:pr-4.5 sm:pl-5',
        handingOver
          ? 'border-transparent bg-secondary text-foreground'
          : 'border-warn-border bg-warn-muted text-warn-on-muted',
        className,
      )}
    >
      <ArrowLeftRight aria-hidden className="mt-0.5 size-5 shrink-0 stroke-[2.25] sm:mt-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm">
            {handingOver ? HANDING_OVER_TITLE : HANDOVER_REQUEST_TITLE}
          </p>
          <p className="mt-0.5 text-note text-muted-foreground">
            {handingOver ? HANDING_OVER_NOTE : handoverRequestNote(remaining === 0)}
          </p>
          {failed && !handingOver ? (
            <p role="alert" className="mt-1.5 text-note text-destructive">
              {HANDOVER_FAILED}
            </p>
          ) : null}
        </div>
        {handingOver ? null : (
          <div className="flex shrink-0 items-center justify-end gap-3">
            {remaining === null ? null : <HandoverCountdown remainingMs={remaining} />}
            <Button size="action" disabled={busy} onClick={onHandOver}>
              {HAND_OVER}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
