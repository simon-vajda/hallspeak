import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { $api } from '@/api/client';
import { useSignal } from '@/lib/use-signal';

export const Route = createFileRoute('/events/$pin/')({ component: EventPage });

function EventPage() {
  const { pin } = Route.useParams();
  const navigate = useNavigate();
  const { data, isPending, error } = $api.useQuery('get', '/events/{pin}', {
    params: { path: { pin } },
  });

  // Only after the GET returns 200 — never in parallel with it (spec E §7).
  const { status, online } = useSignal(data ? { pin } : null);

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

  if (isPending) return <p>Loading…</p>;
  if (error || !data) return <p>Event not found.</p>;

  return (
    <main className="mx-auto max-w-md space-y-4 p-8">
      <h1 className="text-xl">{data.name}</h1>
      {data.description ? <p>{data.description}</p> : null}
      <ul>
        {data.channels.map((channel) => (
          <li key={channel.slug}>
            <Link to="/events/$pin/$slug" params={{ pin, slug: channel.slug }}>
              {channel.name}
            </Link>{' '}
            {(online[channel.slug] ?? channel.online) ? 'live' : 'offline'}
          </li>
        ))}
      </ul>
      <p className="text-xs">signal: {status}</p>
    </main>
  );
}
