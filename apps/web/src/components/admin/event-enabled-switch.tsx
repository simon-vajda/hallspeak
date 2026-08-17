import type { components } from '@linguacast/contract/openapi';
import { useState } from 'react';
import { $api } from '@/api/client';
import { EnabledSwitch } from '@/components/admin/enabled-switch';
import { eventScope, useOptimisticEventUpdate } from '@/lib/admin-queries';

type AdminEventDetail = components['schemas']['AdminEventDetail'];

export function EventEnabledSwitch({
  event,
  className,
}: {
  event: Pick<AdminEventDetail, 'id' | 'name' | 'enabled'>;
  className?: string;
}) {
  const cache = useOptimisticEventUpdate(event.id);
  const [failed, setFailed] = useState(false);

  const { mutate } = $api.useMutation('patch', '/admin/events/{id}', {
    // Writes to one event run one at a time: toggled twice quickly, the first settle refetch
    // would land while the second is still travelling and the screen would keep its value.
    scope: { id: eventScope(event.id) },
    onMutate: ({ body }) => {
      setFailed(false);
      return cache.apply((current) => ({ ...current, enabled: body.enabled ?? current.enabled }));
    },
    onError: (_error, _variables, previous) => {
      cache.rollback(previous);
      setFailed(true);
    },
    onSettled: cache.settle,
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
