import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { ChannelRow } from '@/components/guest/channel-row';
import { EventHeader } from '@/components/guest/event-header';
import { EventRouteError } from '@/components/guest/event-route-error';
import { GuestMessage, GuestShell } from '@/components/guest/guest-message';
import { MICRO_LABEL } from '@/components/micro-label';
import { publicEventQueryOptions } from '@/lib/public-queries';
import { useConnectionToast } from '@/lib/use-connection-toast';
import { useSocket } from '@/lib/use-socket';

export const Route = createFileRoute('/events/$pin/')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(publicEventQueryOptions(params.pin)),
  pendingComponent: () => (
    <GuestMessage title="Looking for your event" body="One moment — checking that PIN." />
  ),
  errorComponent: EventRouteError,
  component: EventPage,
});

function EventPage() {
  const { pin } = Route.useParams();
  const { data } = useSuspenseQuery(publicEventQueryOptions(pin));

  // Only after the GET returns 200, never in parallel with it.
  const { status, online } = useSocket(data ? { pin } : null);

  useConnectionToast(status);

  return (
    <GuestShell>
      <div className="grid items-start gap-6 lg:grid-cols-2 lg:gap-16">
        <EventHeader
          name={data.name}
          description={data.description}
          pin={data.pin}
          live={status === 'connected'}
          className="lg:max-w-117.5"
        />

        <div className="flex flex-col gap-2.5 lg:gap-3">
          <h2 className={MICRO_LABEL}>Choose a channel</h2>
          {data.channels.map((channel) => (
            <ChannelRow
              key={channel.slug}
              channel={channel}
              pin={pin}
              online={online[channel.slug] ?? channel.online}
            />
          ))}
        </div>
      </div>

      {/* Bottomed on a phone, where the design puts it; under the left column from `lg`. */}
      <p className="mt-auto pt-10 text-note text-muted-foreground lg:max-w-95">
        Channels turn on when their interpreter connects. Leave this page open — it updates on its
        own.
      </p>
    </GuestShell>
  );
}
