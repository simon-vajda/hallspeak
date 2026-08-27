import type { components } from '@linguacast/contract/openapi';
import { EventNameLink, ListenerEventLink } from '@/components/admin/admin-event-links';
import { ChannelChips } from '@/components/admin/channel-chips';
import { EventEnabledSwitch } from '@/components/admin/event-enabled-switch';
import { adminEventStatusLabel } from '@/lib/admin-event-list';
import { cn } from '@/lib/utils';

type AdminEventDetail = components['schemas']['AdminEventDetail'];

export function AdminEventCard({ event, onAir }: { event: AdminEventDetail; onAir: number }) {
  const dim = event.enabled ? undefined : 'opacity-60';

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
        {adminEventStatusLabel(event, onAir)}
      </p>
    </li>
  );
}
