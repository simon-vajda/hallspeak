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
  const [failed, setFailed] = useState(false);

  const { mutate, isPending } = $api.useMutation('patch', '/admin/events/{id}', {
    onMutate: async (variables) => {
      setFailed(false);
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<AdminEventDetail[]>(listKey);
      queryClient.setQueryData<AdminEventDetail[]>(listKey, (events) =>
        events?.map((candidate) =>
          candidate.id === event.id
            ? { ...candidate, enabled: variables.body.enabled ?? candidate.enabled }
            : candidate,
        ),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(listKey, context.previous);
      setFailed(true);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: listKey }),
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
