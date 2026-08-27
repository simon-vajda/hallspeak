import type { components } from '@linguacast/contract/openapi';
import { useState } from 'react';
import { $api } from '@/api/client';
import { EnabledSwitch } from '@/components/admin/enabled-switch';
import { eventScope, useOptimisticEventUpdate } from '@/lib/admin-queries';

type AdminChannel = components['schemas']['AdminChannel'];

export function ChannelEnabledSwitch({ channel }: { channel: AdminChannel }) {
  const cache = useOptimisticEventUpdate(channel.eventId);
  const [failed, setFailed] = useState(false);
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

  return (
    <EnabledSwitch
      checked={channel.enabled}
      failed={failed}
      label={`Enable ${channel.name}`}
      onCheckedChange={(enabled) => {
        mutate({ params: { path: { id: channel.id } }, body: { enabled } });
      }}
    />
  );
}
