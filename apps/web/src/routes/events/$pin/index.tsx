import { createFileRoute, Link } from '@tanstack/react-router';
import { $api } from '@/api/client';
import { ChannelRow } from '@/components/guest/channel-row';
import { EventHeader } from '@/components/guest/event-header';
import { GuestMessage, GuestMessageAction, GuestShell } from '@/components/guest/guest-message';
import { useConnectionToast } from '@/lib/use-connection-toast';
import { useSocket } from '@/lib/use-socket';

export const Route = createFileRoute('/events/$pin/')({ component: EventPage });

function EventPage() {
  const { pin } = Route.useParams();
  const { data, isPending, error } = $api.useQuery('get', '/events/{pin}', {
    params: { path: { pin } },
  });

  // Only after the GET returns 200, never in parallel with it.
  const { status, online } = useSocket(data ? { pin } : null);

  useConnectionToast(status);

  if (isPending) {
    return <GuestMessage title="Looking for your event" body="One moment — checking that PIN." />;
  }

  if (error || !data) {
    // 404 parity: a wrong PIN and an unopened event are the same answer, so the copy never
    // guesses which one happened.
    return (
      <GuestMessage
        title="No event with that PIN"
        body="Check the six digits on the card at your seat. If they match, the event may not have started yet."
      >
        <GuestMessageAction link={<Link to="/" />}>Try another PIN</GuestMessageAction>
      </GuestMessage>
    );
  }

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
          <h2 className="text-label uppercase text-muted-foreground">Choose a channel</h2>
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
