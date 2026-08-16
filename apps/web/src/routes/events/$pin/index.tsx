import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { type ReactNode, useEffect } from 'react';
import { $api } from '@/api/client';
import { ChannelRow } from '@/components/guest/channel-row';
import { EventHeader } from '@/components/guest/event-header';
import { GuestHeader } from '@/components/guest/guest-header';
import { TempThemeToggle } from '@/components/temp-theme-toggle';
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
    return (
      <GuestMessage
        title="Looking for your event"
        body="One moment — checking that PIN."
        back={false}
      />
    );
  }

  if (error || !data) {
    // A wrong PIN and an event that has not been opened yet are the same answer by design
    // (404 parity), so the copy never guesses which one happened.
    return (
      <GuestMessage
        title="No event with that PIN"
        body="Check the six digits on the card at your seat. If they match, the event may not have started yet."
      />
    );
  }

  return (
    <Shell>
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
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="absolute top-3.5 right-gutter z-10 lg:top-4 lg:right-10">
        <TempThemeToggle />
      </div>

      <GuestHeader />

      <main className="flex flex-1 flex-col px-gutter pt-7 pb-gutter lg:px-10 lg:pt-15 lg:pb-16.5">
        {children}
      </main>
    </div>
  );
}

function GuestMessage({
  title,
  body,
  back = true,
}: {
  title: string;
  body: string;
  back?: boolean;
}) {
  return (
    <Shell>
      <h1 className="text-screen lg:max-w-117.5 lg:text-[52px] lg:leading-[1.03] lg:tracking-[-0.045em]">
        {title}
      </h1>
      <p className="mt-2.5 max-w-115 text-sm leading-normal text-muted-foreground lg:text-[17px] lg:leading-[1.6]">
        {body}
      </p>
      {back && (
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
      )}
    </Shell>
  );
}
