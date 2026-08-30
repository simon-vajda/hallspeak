import type { components } from '@linguacast/contract/openapi';
import { PowerOff } from 'lucide-react';
import { useState } from 'react';
import { $api } from '@/api/client';
import { EnabledSwitch } from '@/components/admin/enabled-switch';
import { LiveWarning } from '@/components/admin/live-warning';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { channelLiveWarning } from '@/lib/admin-live-warning';
import { eventScope, useOptimisticEventUpdate } from '@/lib/admin-queries';
import type { ChannelBroadcast } from '@/lib/format';

type AdminChannel = components['schemas']['AdminChannel'];

export function ChannelEnabledSwitch({
  channel,
  broadcast,
}: {
  channel: AdminChannel;
  broadcast: ChannelBroadcast;
}) {
  const cache = useOptimisticEventUpdate(channel.eventId);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const warning = channelLiveWarning({ enabled: channel.enabled, broadcast });
  const { mutate } = $api.useMutation('patch', '/admin/channels/{id}', {
    scope: { id: eventScope(channel.eventId) },
    onMutate: ({ body }) => {
      setFailed(false);
      return cache.apply((event) => ({
        ...event,
        channels: event.channels.map((candidate) =>
          candidate.id === channel.id
            ? { ...candidate, enabled: body.enabled ?? candidate.enabled }
            : candidate,
        ),
      }));
    },
    onError: (_error, _variables, previous) => {
      cache.rollback(previous);
      setFailed(true);
    },
    onSettled: cache.settle,
  });

  const disable = () => mutate({ params: { path: { id: channel.id } }, body: { enabled: false } });

  return (
    <>
      <EnabledSwitch
        checked={channel.enabled}
        failed={failed}
        label={`Enable ${channel.name}`}
        onCheckedChange={(enabled) => {
          // Only switching a live channel off asks: enabling never takes anything down, and an
          // idle channel stays one press.
          if (!enabled && warning) {
            setConfirming(true);
            return;
          }
          mutate({ params: { path: { id: channel.id } }, body: { enabled } });
        }}
      />

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        icon={<PowerOff className="size-5" />}
        title={`Disable ${channel.name}?`}
        confirmLabel="Disable anyway"
        cancelLabel="Leave it on"
        onConfirm={() => {
          setConfirming(false);
          disable();
        }}
      >
        {warning && <LiveWarning>{warning}</LiveWarning>}
        <p>Everyone listening is disconnected and no one can rejoin until it is enabled again.</p>
      </ConfirmDialog>
    </>
  );
}
