import type { components } from '@linguacast/contract/openapi';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { $api } from '@/api/client';
import { ChannelChips } from '@/components/admin/channel-chips';
import { EventFormDialog } from '@/components/admin/event-dialogs';
import { EventEnabledSwitch } from '@/components/admin/event-enabled-switch';
import { Button } from '@/components/ui/button';
import { useAdminLive } from '@/lib/admin-queries';
import { eventStatusLabel, formatPin, plural } from '@/lib/format';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/admin/events/')({ component: AdminEventsPage });

type AdminEventDetail = components['schemas']['AdminEventDetail'];

// The design draws a table at desktop width and cards on a phone. Both are rendered and one is
// hidden: one markup for both would mean fighting the card's stacking at every breakpoint.
const TABLE_COLUMNS = 'grid-cols-[1.8fr_0.85fr_1.9fr_0.95fr_110px]';

function AdminEventsPage() {
  const { data, isPending, isError } = $api.useQuery('get', '/admin/events');
  const live = useAdminLive();
  const [creating, setCreating] = useState(false);

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading events…</p>;
  }

  if (isError || !data) {
    return (
      <div>
        <h1 className="text-screen">Events</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Could not load the event list — the request to the server failed. Reload to try again.
        </p>
      </div>
    );
  }

  return (
    <div>
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-screen">Events</h1>
          <p className="mt-1 text-sm text-muted-foreground">{summarise(data)}</p>
        </div>
        <NewEventButton
          size="default"
          onClick={() => setCreating(true)}
          className="hidden h-9.5 rounded-full px-4.25 text-sm font-semibold lg:inline-flex"
        />
      </header>

      {data.length === 0 ? (
        <div className="mt-6 rounded-lg border border-border border-dashed px-5 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No events yet. An event carries the PIN guests type and the channels they pick from.
          </p>
          <NewEventButton onClick={() => setCreating(true)} className="mt-8 w-full lg:w-auto" />
        </div>
      ) : (
        <>
          <ul className="mt-5 flex flex-col gap-3 lg:hidden">
            {data.map((event) => (
              <EventCard key={event.id} event={event} onAir={live.onAir.get(event.id) ?? 0} />
            ))}
          </ul>

          <NewEventButton onClick={() => setCreating(true)} className="mt-8 w-full lg:hidden" />

          <div className="mt-6 hidden lg:block">
            <div
              aria-hidden="true"
              className={cn(
                'grid px-5 pb-2.5 text-label text-muted-foreground uppercase',
                TABLE_COLUMNS,
              )}
            >
              <span>Event</span>
              <span>PIN</span>
              <span>Channels</span>
              <span>Status</span>
              <span className="text-right">Enabled</span>
            </div>
            <ul>
              {data.map((event) => (
                <EventRow key={event.id} event={event} onAir={live.onAir.get(event.id) ?? 0} />
              ))}
            </ul>
          </div>
        </>
      )}

      <EventFormDialog mode="create" open={creating} onOpenChange={setCreating} />
    </div>
  );
}

function EventRow({ event, onAir }: { event: AdminEventDetail; onAir: number }) {
  // Only the cells dim: opacity composites, so a switch inside a dimmed row could not paint
  // itself back to full strength, and it stays operable on a disabled event.
  const dim = event.enabled ? undefined : 'opacity-60';

  return (
    <li className={cn('grid items-center border-t border-border px-5 py-4.5', TABLE_COLUMNS)}>
      <div className={dim}>
        <EventNameLink event={event} className="text-[18px] tracking-[-0.025em]" />
        {event.description && (
          <p className="mt-0.5 text-[13px] text-muted-foreground">{event.description}</p>
        )}
      </div>
      <p className={cn('font-semibold text-[16px] tracking-[0.04em]', dim)}>
        <span className="sr-only">PIN </span>
        {formatPin(event.pin)}
      </p>
      <ChannelChips channels={event.channels} variant="collapse" className={dim} />
      <p className={cn('text-meta text-muted-foreground', dim)}>{statusLabel(event, onAir)}</p>
      <div className="flex justify-end">
        <EventEnabledSwitch event={event} />
      </div>
    </li>
  );
}

function EventCard({ event, onAir }: { event: AdminEventDetail; onAir: number }) {
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
          <EventNameLink event={event} className="text-[19px] tracking-[-0.025em]" />
          <p className="mt-0.5 text-[13px] text-muted-foreground">PIN {formatPin(event.pin)}</p>
        </div>
        <EventEnabledSwitch event={event} />
      </div>
      <ChannelChips channels={event.channels} variant="wrap" className={cn('mt-3', dim)} />
      <p className={cn('mt-3 text-meta text-muted-foreground', dim)}>{statusLabel(event, onAir)}</p>
    </li>
  );
}

function EventNameLink({ event, className }: { event: AdminEventDetail; className?: string }) {
  return (
    <Link
      to="/admin/events/$id"
      params={{ id: event.id }}
      className={cn(
        'font-semibold hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
        className,
      )}
    >
      {event.name}
    </Link>
  );
}

function NewEventButton({
  className,
  size = 'pill',
  onClick,
}: {
  className?: string;
  size?: 'pill' | 'default';
  onClick: () => void;
}) {
  return (
    <Button size={size} onClick={onClick} className={cn('gap-2', className)}>
      <Plus />
      New event
    </Button>
  );
}

// "Status" is enablement until there is something to be live about, then liveness. No listener
// number appears at either width: a sum across an event's channels answers a question nobody
// asks at the list level.
function statusLabel(event: AdminEventDetail, onAir: number) {
  return eventStatusLabel({ enabled: event.enabled, channels: event.channels.length, onAir });
}

function summarise(events: AdminEventDetail[]) {
  if (events.length === 0) return 'Nothing here yet';

  const enabled = events.filter((event) => event.enabled).length;
  const channels = events.reduce((total, event) => total + event.channels.length, 0);
  return `${enabled} of ${plural(events.length, 'event')} enabled · ${plural(channels, 'channel')}`;
}
