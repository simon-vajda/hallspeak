import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { $api } from '@/api/client';
import { ChannelRow } from '@/components/guest/channel-row';
import { EventHeader } from '@/components/guest/event-header';
import { GuestMessage, GuestShell } from '@/components/guest/guest-message';
import { Button } from '@/components/ui/button';
import { useSocket } from '@/lib/use-socket';

export const Route = createFileRoute('/events/$pin/')({ component: EventPage });

function EventPage() {
  const { pin } = Route.useParams();
  const navigate = useNavigate();
  const { data, isPending, error } = $api.useQuery('get', '/events/{pin}', {
    params: { path: { pin } },
  });

  // Only after the GET returns 200 — never in parallel with it (spec E §7).
  const { status, online } = useSocket(data ? { pin } : null);

  // With one option there is nothing to choose, so the selector gets out of the way.
  // `replace` so Back does not bounce the guest between the two.
  const onlyChannel = data?.channels.length === 1 ? data.channels[0] : undefined;
  useEffect(() => {
    if (!onlyChannel) return;
    navigate({
      to: '/events/$pin/$slug',
      params: { pin, slug: onlyChannel.slug },
      replace: true,
    });
  }, [onlyChannel, navigate, pin]);

  if (isPending) {
    return <GuestMessage title="Looking for your event" body="One moment — checking that PIN." />;
  }

  if (error || !data) {
    // A wrong PIN and an event that has not been opened yet are the same answer by design
    // (404 parity), so the copy never guesses which one happened.
    return (
      <GuestMessage
        title="No event with that PIN"
        body="Check the six digits on the card at your seat. If they match, the event may not have started yet."
      >
        <Button
          variant="outline"
          size="pill"
          // It navigates, so it renders as an anchor and Base UI has to be told to stop
          // expecting a native <button>.
          nativeButton={false}
          render={<Link to="/" />}
          className="mt-8 w-full lg:w-50"
        >
          Try another PIN
        </Button>
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

      {/* Bottomed on a phone, where the design puts it; under the left column from `lg`,
          which is where 10q's note sat before it was dropped as a playback claim. */}
      <p className="mt-auto pt-10 text-note text-muted-foreground lg:max-w-95">
        Channels turn on when their interpreter connects. Leave this page open — it updates on its
        own.
      </p>
    </GuestShell>
  );
}
