import type { components } from '@linguacast/contract/openapi';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { $api } from '@/api/client';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

type AdminEventDetail = components['schemas']['AdminEventDetail'];

export function EventEnabledSwitch({
  event,
  className,
}: {
  event: Pick<AdminEventDetail, 'id' | 'name' | 'enabled'>;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const listKey = $api.queryOptions('get', '/admin/events').queryKey;
  // The same switch appears on the detail screen, which reads a different query — both are
  // updated and both are invalidated, so the two can never disagree about one event.
  const detailKey = $api.queryOptions('get', '/admin/events/{id}', {
    params: { path: { id: event.id } },
  }).queryKey;
  const [failed, setFailed] = useState(false);

  const { mutate, isPending } = $api.useMutation('patch', '/admin/events/{id}', {
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
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: listKey }),
        queryClient.invalidateQueries({ queryKey: detailKey }),
      ]),
  });

  return (
    <div className={cn('flex flex-col items-end gap-1', className)}>
      <Switch
        size="lg"
        checked={event.enabled}
        disabled={isPending}
        // Enabled is not the same thing as on air, so the checked track is `foreground`
        // and never `primary`.
        className="data-checked:bg-foreground"
        aria-label={`Enable ${event.name}`}
        onCheckedChange={(enabled) => {
          mutate({ params: { path: { id: event.id } }, body: { enabled } });
        }}
      />
      {failed && (
        <p role="status" className="text-right text-meta text-destructive">
          Could not save
        </p>
      )}
    </div>
  );
}
