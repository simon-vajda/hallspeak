import { MicOff } from 'lucide-react';
import { ConfirmDialog } from '@/components/confirm-dialog';

/**
 * Ending always confirms, which is why End broadcast can be a quiet text button. The design
 * opens with a listener count; the studio's own tile already carries it, so the copy here
 * states the consequence rather than repeating the number.
 */
export function EndBroadcastDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
      Anyone listening will be disconnected and the channel goes off air until you or another
      interpreter reconnects.
    </ConfirmDialog>
  );
}
