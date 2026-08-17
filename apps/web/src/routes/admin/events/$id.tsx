import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { $api } from '@/api/client';
import { ChannelsPanel } from '@/components/admin/channels-panel';
import { DeleteEventDialog, EventFormDialog } from '@/components/admin/event-dialogs';
import { EventEnabledSwitch } from '@/components/admin/event-enabled-switch';
import { PinCard } from '@/components/admin/pin-card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/admin/events/$id')({
  component: AdminEventPage,
  // A URL that cannot name an event is the same answer as one that names a deleted event,
  // so it gets the same page rather than the router's error screen.
  errorComponent: () => <MissingEvent notFound />,
  // Typed at the route, not coerced in the component: a URL carrying anything but a positive
  // integer never reaches the query, so it cannot spend three retries on a 400.
  params: {
    parse: ({ id }) => {
      const parsed = Number(id);
      if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`Invalid event id: ${id}`);
      return { id: parsed };
    },
    stringify: ({ id }) => ({ id: String(id) }),
  },
});

const ACTION = 'h-9.5 flex-1 gap-2 rounded-full px-4.25 font-semibold text-sm lg:flex-none';

function AdminEventPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data, isPending, error } = $api.useQuery(
    'get',
    '/admin/events/{id}',
    { params: { path: { id } } },
    // A deleted event will not come back, so retrying only holds the spinner for seconds.
    { retry: (failureCount, err) => err?.code !== 'not_found' && failureCount < 3 },
  );

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading event…</p>;
  }

  // A stale link after a delete is an ordinary case, so it gets the same page as an id that
  // never existed.
  if (!data) {
    return <MissingEvent notFound={error?.code === 'not_found'} />;
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
          <Button variant="outline" onClick={() => setEditing(true)} className={ACTION}>
            <Pencil />
            Edit
          </Button>
          <Button
            variant="outline"
            onClick={() => setDeleting(true)}
            className={cn(
              ACTION,
              'border-destructive-border text-destructive hover:bg-destructive-muted hover:text-destructive',
            )}
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
              <p className="mt-0.5 text-[13px] text-muted-foreground">
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

function MissingEvent({ notFound }: { notFound: boolean }) {
  return (
    <div>
      <h1 className="text-screen">{notFound ? 'Event not found' : 'Could not load this event'}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {notFound
          ? 'It may have been deleted. Its PIN and channels went with it.'
          : 'The request to the server failed. Reload to try again.'}
      </p>
      <Button
        variant="outline"
        // Renders as an anchor, so Base UI must be told not to expect a native <button>.
        nativeButton={false}
        render={<Link to="/admin/events" />}
        className="mt-8 h-9.5 rounded-full px-4.25 font-semibold text-sm"
      >
        Back to events
      </Button>
    </div>
  );
}
