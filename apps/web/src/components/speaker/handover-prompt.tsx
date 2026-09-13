import { HandoverAlert } from '@/components/speaker/handover-alert';
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
    <HandoverAlert
      tone={handingOver ? 'neutral' : 'warn'}
      title={handingOver ? HANDING_OVER_TITLE : HANDOVER_REQUEST_TITLE}
      note={handingOver ? HANDING_OVER_NOTE : handoverRequestNote(remaining === 0)}
      trailing={
        handingOver ? null : (
          <div className="flex shrink-0 items-center justify-end gap-3">
            {remaining === null ? null : <HandoverCountdown remainingMs={remaining} />}
            <Button size="action" disabled={busy} onClick={onHandOver}>
              {HAND_OVER}
            </Button>
          </div>
        )
      }
      className={className}
    >
      {failed && !handingOver ? (
        <p role="alert" className="mt-1.5 text-note text-destructive">
          {HANDOVER_FAILED}
        </p>
      ) : null}
    </HandoverAlert>
  );
}
