import { shouldThrowSettledQueryError } from '@hallspeak/client-core/query-retry';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ChannelsPanel } from '@/components/admin/channels-panel';
import { DeleteEventDialog } from '@/components/admin/delete-event-dialog';
import { EventDetailRouteError } from '@/components/admin/event-detail-route-error';
import { EventDetailSkeleton } from '@/components/admin/event-detail-skeleton';
import { EventEnabledSwitch } from '@/components/admin/event-enabled-switch';
import { EventFormDialog } from '@/components/admin/event-form-dialog';
import { PinCard } from '@/components/admin/pin-card';
import { Button } from '@/components/ui/button';
import { eventDetailQueryOptions } from '@/lib/admin-queries';

export const Route = createFileRoute('/admin/events/$id')({
  // Typed at the route, not coerced in the component: a URL carrying anything but a positive
  // integer never reaches the query, so it cannot spend three retries on a 400.
  params: {
    parse: ({ id }) => {
      const parsed = Number(id);
      if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error(`Invalid event id: ${id}`);
      }
      return { id: parsed };
    },
    stringify: ({ id }) => ({ id: String(id) }),
  },
  // A URL that cannot name an event is the same answer as one that names a deleted event,
  // so it gets the same page rather than the router's error screen.
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(eventDetailQueryOptions(params.id)),
  pendingComponent: EventDetailSkeleton,
  errorComponent: EventDetailRouteError,
  component: AdminEventPage,
});

function AdminEventPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data, error, isFetching } = useSuspenseQuery(eventDetailQueryOptions(id));

  if (shouldThrowSettledQueryError(error, isFetching)) {
    throw error;
  }

  return (
    <div>
      <nav aria-label="Breadcrumb" className="text-meta text-muted-foreground">
        <Link
          to="/admin/events"
          className="transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
        >
          Events
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-foreground">{data.name}</span>
      </nav>

      <header className="mt-2.5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-7.5">
        <div className="lg:max-w-140">
          <h1 className="text-screen">{data.name}</h1>
          {data.description && (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{data.description}</p>
          )}
        </div>
        <div className="flex gap-2.5 lg:flex-none">
          <Button
            variant="outline"
            onClick={() => setEditing(true)}
            size="action"
            className="flex-1 lg:flex-none"
          >
            <Pencil />
            Edit
          </Button>
          <Button
            variant="outline"
            onClick={() => setDeleting(true)}
            size="action"
            className="flex-1 border-destructive-border text-destructive hover:bg-destructive-muted hover:text-destructive lg:flex-none"
          >
            <Trash2 />
            Delete
          </Button>
        </div>
      </header>

      {/* Stacked below `lg`, the right-hand column leads: the PIN is what an admin came for. */}
      <div className="mt-6.5 grid items-start gap-5.5 lg:grid-cols-[1fr_330px]">
        <div className="order-2 lg:order-none">
          <ChannelsPanel event={data} />
        </div>

        <div className="order-1 flex flex-col gap-3.5 lg:order-none">
          <PinCard event={data} />

          <section className="flex items-center justify-between gap-4 rounded-lg border border-border px-5 py-4.5">
            <div>
              <h2 className="text-section">Event enabled</h2>
              <p className="mt-0.5 text-note text-muted-foreground">
                {data.enabled
                  ? 'Guests can join right now'
                  : 'Guests cannot join while this is off'}
              </p>
            </div>
            <EventEnabledSwitch event={data} />
          </section>
        </div>
      </div>

      <EventFormDialog mode="edit" event={data} open={editing} onOpenChange={setEditing} />
      <DeleteEventDialog
        event={data}
        open={deleting}
        onOpenChange={setDeleting}
        onDeleted={() => navigate({ to: '/admin/events' })}
      />
    </div>
  );
}
