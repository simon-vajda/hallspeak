import type { components } from '@linguacast/contract/openapi';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { $api } from '@/api/client';
import { LiveWarning } from '@/components/admin/live-warning';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { channelLiveWarning } from '@/lib/admin-live-warning';
import { invalidateAdminEvents } from '@/lib/admin-queries';
import type { ChannelBroadcast } from '@/lib/format';

type AdminChannel = components['schemas']['AdminChannel'];

export function RegenerateSpeakerCodeDialog({
  channel,
  broadcast,
  open,
  onOpenChange,
}: {
  channel: AdminChannel;
  broadcast: ChannelBroadcast;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const warning = channelLiveWarning({ enabled: channel.enabled, broadcast });
  const queryClient = useQueryClient();
  const [failed, setFailed] = useState(false);
  const { mutate, isPending } = $api.useMutation(
    'post',
    '/admin/channels/{id}/regenerate-speaker-code',
    {
      onMutate: () => setFailed(false),
      onSuccess: async () => {
        await invalidateAdminEvents(queryClient, channel.eventId);
        onOpenChange(false);
      },
      onError: () => setFailed(true),
    },
  );

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      tone="default"
      icon={<RefreshCw className="size-5" />}
      title={`New speaker code for ${channel.name}?`}
      confirmLabel="Generate new code"
      cancelLabel="Keep this code"
      pending={isPending}
      error={
        failed ? 'Could not generate a new code. The old one still works — try again.' : undefined
      }
      onConfirm={() => mutate({ params: { path: { id: channel.id } } })}
    >
      <p>
        The speaker link you have already shared stops working immediately. Send the new one to
        whoever interprets this channel.
      </p>
      <p>Listeners are unaffected — their link does not carry the code.</p>
      {warning && <LiveWarning>{warning} They stay on air until they reload.</LiveWarning>}
    </ConfirmDialog>
  );
}
