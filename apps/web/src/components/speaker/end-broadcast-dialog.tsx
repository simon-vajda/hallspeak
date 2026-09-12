import { MicOff } from 'lucide-react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { END_WITH_HANDOVER } from '@/lib/handover-copy';

/**
 * Ending always confirms, which is why End broadcast can be a quiet text button. The design
 * opens with a listener count; the studio's own tile already carries it, so the copy here
 * states the consequence rather than repeating the number.
 */
export function EndBroadcastDialog({
  open,
  onOpenChange,
  handoverPending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** While somebody is waiting, ending is a handover: the channel does not go off air. */
  handoverPending: boolean;
  onConfirm: () => void;
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={<MicOff className="size-5 stroke-[2.25]" />}
      title="End the broadcast?"
      confirmLabel="End broadcast"
      cancelLabel="Stay on air"
      onConfirm={onConfirm}
    >
      {handoverPending
        ? END_WITH_HANDOVER
        : 'Anyone listening will be disconnected and the channel goes off air until you or another interpreter reconnects.'}
    </ConfirmDialog>
  );
}
