import { shouldThrowSettledQueryError } from '@hallspeak/client-core/query-retry';
import { useSocket } from '@hallspeak/client-core/socket';
import { formatEventPageTitle } from '@hallspeak/contract/page-titles';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { ChannelRow } from '@/components/guest/channel-row';
import { EventHeader } from '@/components/guest/event-header';
import { EventRouteError } from '@/components/guest/event-route-error';
import { EventSkeleton } from '@/components/guest/event-skeleton';
import { GuestShell } from '@/components/guest/guest-message';
import { MICRO_LABEL } from '@/components/micro-label';
import { publicEventQueryOptions } from '@/lib/public-queries';
import { connectSocket } from '@/lib/socket';
import { useDocumentTitle } from '@/lib/use-document-title';

export const Route = createFileRoute('/events/$pin/')({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(publicEventQueryOptions(params.pin)),
  pendingComponent: EventSkeleton,
  errorComponent: EventRouteError,
  component: EventPage,
});

function EventPage() {
  const { pin } = Route.useParams();
  const { data, error, isFetching } = useSuspenseQuery(publicEventQueryOptions(pin));
  useDocumentTitle(formatEventPageTitle(data.name));

  // Only after the GET returns 200, never in parallel with it.
  const { online } = useSocket(data ? { pin } : null, connectSocket);

  if (shouldThrowSettledQueryError(error, isFetching)) {
    throw error;
  }

  return (
    <GuestShell share={{ pin: data.pin, eventName: data.name }}>
      <div className="grid items-start gap-6 lg:grid-cols-2 lg:gap-16">
        <EventHeader
          name={data.name}
          description={data.description}
          pin={data.pin}
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
