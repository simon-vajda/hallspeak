import type { components } from '@hallspeak/contract/openapi';
import { useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { $api } from '@/api/client';
import { LiveWarning } from '@/components/admin/live-warning';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { channelLiveWarning } from '@/lib/admin-live-warning';
import { invalidateAdminEvents } from '@/lib/admin-queries';
import { type ChannelBroadcast, plural } from '@/lib/format';

type AdminChannel = components['schemas']['AdminChannel'];

export function DeleteChannelDialog({
  channel,
  broadcast,
  remaining,
  open,
  onOpenChange,
}: {
  channel: AdminChannel;
  broadcast: ChannelBroadcast;
  remaining: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const warning = channelLiveWarning({ enabled: channel.enabled, broadcast });
  const queryClient = useQueryClient();
  const [failed, setFailed] = useState(false);
  const { mutate, isPending } = $api.useMutation('delete', '/admin/channels/{id}', {
    onMutate: () => setFailed(false),
    onSuccess: async () => {
      await invalidateAdminEvents(queryClient, channel.eventId);
      onOpenChange(false);
    },
    onError: () => setFailed(true),
  });

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={<Trash2 className="size-5" />}
      title={`Delete ${channel.name}?`}
      confirmLabel="Delete"
      cancelLabel="Keep channel"
      pending={isPending}
      error={failed ? 'Could not delete the channel. Nothing was removed — try again.' : undefined}
      onConfirm={() => mutate({ params: { path: { id: channel.id } } })}
    >
      <p>
        <span className="font-mono">/{channel.slug}</span> stops resolving immediately and anyone
        listening to it will be disconnected. The event keeps its PIN
        {remaining > 0
          ? ` and its other ${plural(remaining, 'channel')}`
          : ', but it is left with no channels at all'}
        .
      </p>
      <p>This cannot be undone. A channel added again later gets a different speaker code.</p>
      {warning && <LiveWarning>{warning}</LiveWarning>}
    </ConfirmDialog>
  );
}
