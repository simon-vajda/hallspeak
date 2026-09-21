import type { components } from '@hallspeak/contract/openapi';
import { PowerOff } from 'lucide-react';
import { useState } from 'react';
import { $api } from '@/api/client';
import { EnabledSwitch } from '@/components/admin/enabled-switch';
import { LiveWarning } from '@/components/admin/live-warning';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { disableConfirmation, eventLiveWarning } from '@/lib/admin-live-warning';
import { eventScope, useAdminLive, useOptimisticEventUpdate } from '@/lib/admin-queries';

type AdminEventDetail = components['schemas']['AdminEventDetail'];

export function EventEnabledSwitch({
  event,
  className,
}: {
  event: Pick<AdminEventDetail, 'id' | 'name' | 'enabled'>;
  className?: string;
}) {
  const cache = useOptimisticEventUpdate(event.id);
  const live = useAdminLive();
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const warning = eventLiveWarning({
    enabled: event.enabled,
    onAir: live.onAir.get(event.id) ?? 0,
    liveKnown: live.known,
  });
  const notice = disableConfirmation({ warning, liveKnown: live.known });

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
    <>
      <EnabledSwitch
        checked={event.enabled}
        failed={failed}
        label={`Enable ${event.name}`}
        className={className}
        onCheckedChange={(enabled) => {
          // Only switching off asks, and only when the event may be live: enabling never
          // takes anything down, and an idle event under a healthy poll stays one press.
          if (!enabled && notice) {
            setConfirming(true);
            return;
          }
          mutate({ params: { path: { id: event.id } }, body: { enabled } });
        }}
      />

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        icon={<PowerOff className="size-5" />}
        title={`Disable ${event.name}?`}
        confirmLabel="Disable anyway"
        cancelLabel="Leave it on"
        onConfirm={() => {
          setConfirming(false);
          mutate({ params: { path: { id: event.id } }, body: { enabled: false } });
        }}
      >
        {notice && <LiveWarning tone={notice.tone}>{notice.message}</LiveWarning>}
        <p>Everyone listening is disconnected and no one can rejoin until it is enabled again.</p>
      </ConfirmDialog>
    </>
  );
}
