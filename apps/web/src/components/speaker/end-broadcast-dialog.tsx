import { MicOff } from 'lucide-react';
import { ConfirmDialog } from '@/components/confirm-dialog';

/**
 * `10n`. Ending always confirms — which is the whole reason End broadcast can afford to be
 * a quiet text button rather than a red one.
 *
 * The canvas opens with "37 people are listening to English". Nothing counts listeners, so
 * the copy states only what is certain: whoever is there loses the channel. `ConfirmDialog`
 * is not admin-specific despite where it is filed — it is the destructive confirmation this
 * app has, disc and stacked buttons included.
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
