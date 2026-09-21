import type { components } from '@hallspeak/contract/openapi';
import { EventNameLink, ListenerEventLink } from '@/components/admin/admin-event-links';
import { ChannelChips } from '@/components/admin/channel-chips';
import { EventEnabledSwitch } from '@/components/admin/event-enabled-switch';
import { adminEventStatusLabel } from '@/lib/admin-event-list';
import { STATUS_UNKNOWN } from '@/lib/format';
import { cn } from '@/lib/utils';

type AdminEventDetail = components['schemas']['AdminEventDetail'];

export function AdminEventCard({
  event,
  onAir,
  liveKnown,
}: {
  event: AdminEventDetail;
  onAir: number;
  liveKnown: boolean;
}) {
  const dim = event.enabled ? undefined : 'opacity-60';
  const status = adminEventStatusLabel(event, onAir, liveKnown);

  return (
    <li
      className={cn(
        'rounded-lg px-5 py-4.5',
        event.enabled ? 'bg-secondary' : 'border border-dashed border-border',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={dim}>
          <EventNameLink event={event} className="text-subtitle" />
          <p className="mt-0.5 text-note text-muted-foreground">
            PIN <ListenerEventLink event={event} />
          </p>
        </div>
        <EventEnabledSwitch event={event} />
      </div>
      <ChannelChips channels={event.channels} variant="wrap" className={cn('mt-3', dim)} />
      <p className={cn('mt-3 text-meta text-muted-foreground', dim)}>
        {status.label}
        {status.withheld && <span className="sr-only">{STATUS_UNKNOWN}</span>}
      </p>
    </li>
  );
}
