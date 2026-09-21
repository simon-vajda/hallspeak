import type { components } from '@hallspeak/contract/openapi';
import { EventNameLink, ListenerEventLink } from '@/components/admin/admin-event-links';
import { ChannelChips } from '@/components/admin/channel-chips';
import { EventEnabledSwitch } from '@/components/admin/event-enabled-switch';
import { ADMIN_EVENT_TABLE_COLUMNS, adminEventStatusLabel } from '@/lib/admin-event-list';
import { STATUS_UNKNOWN } from '@/lib/format';
import { cn } from '@/lib/utils';

type AdminEventDetail = components['schemas']['AdminEventDetail'];

export function AdminEventRow({
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
        'grid items-center border-t border-border px-5 py-4.5',
        ADMIN_EVENT_TABLE_COLUMNS,
      )}
    >
      <div className={dim}>
        <EventNameLink event={event} className="text-subtitle" />
        {event.description && (
          <p className="mt-0.5 text-note text-muted-foreground">{event.description}</p>
        )}
      </div>
      <p className={cn('font-semibold text-base', dim)}>
        <span className="sr-only">PIN </span>
        <ListenerEventLink event={event} />
      </p>
      <ChannelChips channels={event.channels} variant="collapse" className={dim} />
      <p className={cn('text-meta text-muted-foreground', dim)}>
        {status.label}
        {status.withheld && <span className="sr-only">{STATUS_UNKNOWN}</span>}
      </p>
      <div className="flex justify-end">
        <EventEnabledSwitch event={event} />
      </div>
    </li>
  );
}
