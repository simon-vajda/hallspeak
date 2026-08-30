import type { components } from '@linguacast/contract/openapi';
import { useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { $api } from '@/api/client';
import { LiveWarning } from '@/components/admin/live-warning';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { eventLiveWarning } from '@/lib/admin-live-warning';
import { eventDetailKey, eventsListKey, useAdminLive } from '@/lib/admin-queries';
import { formatPin, plural } from '@/lib/format';

type AdminEventDetail = components['schemas']['AdminEventDetail'];

export function DeleteEventDialog({
  event,
  open,
  onOpenChange,
  onDeleted,
}: {
  event: AdminEventDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void | Promise<void>;
}) {
  const queryClient = useQueryClient();
  const live = useAdminLive();
  const [failed, setFailed] = useState(false);
  const { mutate, isPending } = $api.useMutation('delete', '/admin/events/{id}', {
    onMutate: () => setFailed(false),
    onSuccess: async () => {
      onOpenChange(false);
      await onDeleted?.();
      queryClient.removeQueries({ queryKey: eventDetailKey(event.id) });
      await queryClient.invalidateQueries({ queryKey: eventsListKey() });
    },
    onError: () => setFailed(true),
  });
  const channels = event.channels.length;
  const warning = eventLiveWarning({
    enabled: event.enabled,
    onAir: live.onAir.get(event.id) ?? 0,
    liveKnown: live.known,
  });

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={<Trash2 className="size-5" />}
      title={`Delete ${event.name}?`}
      confirmLabel="Delete"
      cancelLabel="Keep event"
      pending={isPending}
      error={failed ? 'Could not delete the event. Nothing was removed — try again.' : undefined}
      onConfirm={() => mutate({ params: { path: { id: event.id } } })}
    >
      <p>
        {channels > 0 && `Its ${plural(channels, 'channel')} go with it, and `}
        PIN {formatPin(event.pin)} stops working immediately. Anyone listening right now will be
        disconnected.
      </p>
      <p>This cannot be undone.</p>
      {warning && <LiveWarning>{warning}</LiveWarning>}
    </ConfirmDialog>
  );
}
