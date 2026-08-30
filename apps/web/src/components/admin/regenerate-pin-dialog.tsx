import type { components } from '@linguacast/contract/openapi';
import { useQueryClient } from '@tanstack/react-query';
import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { $api } from '@/api/client';
import { LiveWarning } from '@/components/admin/live-warning';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { eventLiveWarning } from '@/lib/admin-live-warning';
import { invalidateAdminEvents, useAdminLive } from '@/lib/admin-queries';
import { formatPin } from '@/lib/format';

type AdminEventDetail = components['schemas']['AdminEventDetail'];

export function RegeneratePinDialog({
  event,
  open,
  onOpenChange,
}: {
  event: Pick<AdminEventDetail, 'id' | 'pin' | 'enabled'>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const live = useAdminLive();
  const [failed, setFailed] = useState(false);
  const warning = eventLiveWarning({
    enabled: event.enabled,
    onAir: live.onAir.get(event.id) ?? 0,
    liveKnown: live.known,
  });
  const { mutate, isPending } = $api.useMutation('post', '/admin/events/{id}/regenerate-pin', {
    onMutate: () => setFailed(false),
    onSuccess: async () => {
      onOpenChange(false);
      await invalidateAdminEvents(queryClient, event.id);
    },
    onError: () => setFailed(true),
  });

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      tone="default"
      icon={<KeyRound className="size-5" />}
      title="Generate a new PIN?"
      confirmLabel="Generate new PIN"
      cancelLabel="Keep this PIN"
      pending={isPending}
      error={
        failed ? 'Could not generate a new PIN. The old one still works — try again.' : undefined
      }
      onConfirm={() => mutate({ params: { path: { id: event.id } } })}
    >
      <p>
        PIN {formatPin(event.pin)} stops working the moment the new one exists. Any cards or QR
        codes already printed with it have to be reprinted.
      </p>
      <p>Anyone listening now will be disconnected and will have to rejoin with the new PIN.</p>
      {warning && <LiveWarning>{warning}</LiveWarning>}
    </ConfirmDialog>
  );
}
