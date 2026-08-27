import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { AdminEventCard } from '@/components/admin/admin-event-card';
import { AdminEventRow } from '@/components/admin/admin-event-row';
import { EventFormDialog } from '@/components/admin/event-form-dialog';
import { EventsRouteError } from '@/components/admin/events-route-error';
import { MICRO_LABEL } from '@/components/micro-label';
import { Button } from '@/components/ui/button';
import { ADMIN_EVENT_TABLE_COLUMNS, summariseAdminEvents } from '@/lib/admin-event-list';
import { eventsListQueryOptions, useAdminLive } from '@/lib/admin-queries';
import { shouldThrowSettledQueryError } from '@/lib/query-retry';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/admin/events/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(eventsListQueryOptions()),
  pendingComponent: () => <p className="text-sm text-muted-foreground">Loading events…</p>,
  errorComponent: EventsRouteError,
  component: AdminEventsPage,
});

function AdminEventsPage() {
  const { data, error, isFetching } = useSuspenseQuery(eventsListQueryOptions());
  const live = useAdminLive();
  const [creating, setCreating] = useState(false);

  if (shouldThrowSettledQueryError(error, isFetching)) {
    throw error;
  }

  return (
    <div>
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-screen">Events</h1>
          <p className="mt-1 text-sm text-muted-foreground">{summariseAdminEvents(data)}</p>
        </div>
        <NewEventButton
          size="action"
          onClick={() => setCreating(true)}
          className="hidden lg:inline-flex"
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
              <AdminEventCard key={event.id} event={event} onAir={live.onAir.get(event.id) ?? 0} />
            ))}
          </ul>

          <NewEventButton onClick={() => setCreating(true)} className="mt-8 w-full lg:hidden" />

          <div className="mt-6 hidden lg:block">
            <div
              aria-hidden="true"
              className={cn('grid px-5 pb-2.5', MICRO_LABEL, ADMIN_EVENT_TABLE_COLUMNS)}
            >
              <span>Event</span>
              <span>PIN</span>
              <span>Channels</span>
              <span>Status</span>
              <span className="text-right">Enabled</span>
            </div>
            <ul>
              {data.map((event) => (
                <AdminEventRow key={event.id} event={event} onAir={live.onAir.get(event.id) ?? 0} />
              ))}
            </ul>
          </div>
        </>
      )}

      <EventFormDialog mode="create" open={creating} onOpenChange={setCreating} />
    </div>
  );
}

function NewEventButton({
  className,
  size = 'pill',
  onClick,
}: {
  className?: string;
  size?: 'pill' | 'action';
  onClick: () => void;
}) {
  return (
    <Button size={size} onClick={onClick} className={cn('gap-2', className)}>
      <Plus />
      New event
    </Button>
  );
}
