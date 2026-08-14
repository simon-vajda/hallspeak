import type { components } from '@linguacast/contract/openapi';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { $api } from '@/api/client';
import { EnabledSwitch } from '@/components/admin/enabled-switch';
import { eventDetailKey, eventsListKey, invalidateAdminEvents } from '@/lib/admin-queries';

type AdminEventDetail = components['schemas']['AdminEventDetail'];

export function EventEnabledSwitch({
  event,
  className,
}: {
  event: Pick<AdminEventDetail, 'id' | 'name' | 'enabled'>;
  className?: string;
}) {
  const queryClient = useQueryClient();
  // The same switch appears on the detail screen, which reads a different query — both are
  // updated and both are invalidated, so the two can never disagree about one event.
  const listKey = eventsListKey();
  const detailKey = eventDetailKey(event.id);
  const [failed, setFailed] = useState(false);

  const { mutate } = $api.useMutation('patch', '/admin/events/{id}', {
    onMutate: async (variables) => {
      setFailed(false);
      await Promise.all([
        queryClient.cancelQueries({ queryKey: listKey }),
        queryClient.cancelQueries({ queryKey: detailKey }),
      ]);
      const enabled = variables.body.enabled;
      const previous = {
        list: queryClient.getQueryData<AdminEventDetail[]>(listKey),
        detail: queryClient.getQueryData<AdminEventDetail>(detailKey),
      };

      queryClient.setQueryData<AdminEventDetail[]>(listKey, (events) =>
        events?.map((candidate) =>
          candidate.id === event.id
            ? { ...candidate, enabled: enabled ?? candidate.enabled }
            : candidate,
        ),
      );
      queryClient.setQueryData<AdminEventDetail>(
        detailKey,
        (current) => current && { ...current, enabled: enabled ?? current.enabled },
      );

      return previous;
    },
    onError: (_error, _variables, context) => {
      if (context?.list) queryClient.setQueryData(listKey, context.list);
      if (context?.detail) queryClient.setQueryData(detailKey, context.detail);
      setFailed(true);
    },
    onSettled: () => invalidateAdminEvents(queryClient, event.id),
  });

  return (
    <EnabledSwitch
      checked={event.enabled}
      failed={failed}
      label={`Enable ${event.name}`}
      className={className}
      onCheckedChange={(enabled) => {
        mutate({ params: { path: { id: event.id } }, body: { enabled } });
      }}
    />
  );
}
