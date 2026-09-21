import type { components } from '@hallspeak/contract/openapi';
import { ChannelForm } from '@/components/admin/channel-form';
import { Dialog, DialogContent } from '@/components/ui/dialog';

type AdminChannel = components['schemas']['AdminChannel'];

/** Add and edit share one form. A slug is fixed once chosen, so edit never sends it. */
export function ChannelFormDialog({
  open,
  onOpenChange,
  eventId,
  channel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: number;
  channel?: AdminChannel;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-105">
        <ChannelForm eventId={eventId} channel={channel} onSaved={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
