import { createFileRoute } from '@tanstack/react-router';
import { useEffect } from 'react';
import { z } from 'zod';
import { $api } from '@/api/client';
import { useSocket } from '@/lib/use-socket';

// The speaker studio is the SAME route as the listener room, branching on the presence
// of speaker_code. That keeps the speaker URL degrading into valid public URLs: drop
// the query param and you are a listener; drop the slug and you are on the selector.
const SearchSchema = z.object({ speaker_code: z.string().optional() });

export const Route = createFileRoute('/events/$pin/$slug')({
  component: ChannelPage,
  validateSearch: SearchSchema,
});

/** Maps the handshake gate's connect_error to a message. Never a 404 — see useSocket. */
function socketMessage(code: string): string {
  if (code === 'channel_busy') return 'Someone is already speaking on this channel.';
  if (code === 'client_too_old') return 'This page is out of date. Reload it.';
  return `Connection failed: ${code}`;
}

function ChannelPage() {
  const { pin, slug } = Route.useParams();
  const { speaker_code: speakerCode } = Route.useSearch();

  const { data, isPending, error } = $api.useQuery('get', '/events/{pin}/{slug}', {
    params: {
      path: { pin, slug },
      query: speakerCode ? { speaker_code: speakerCode } : {},
    },
  });

  const {
    status,
    error: socketError,
    online,
    socket,
  } = useSocket(data ? (speakerCode ? { pin, speakerCode } : { pin }) : null);

  // A speaker is already in its channel room from the handshake; a listener has to ask.
  useEffect(() => {
    if (!socket || status !== 'connected' || data?.role !== 'listener') return;
    void socket.emitWithAck('channel:join', { slug }).catch(() => {});
    return () => {
      socket.emit('channel:leave', { slug });
    };
  }, [socket, status, data?.role, slug]);

  if (isPending) return <p>Loading…</p>;
  // The two failure classes stay separate: this one is authorization, from the GET.
  if (error) {
    return <p>{error.code === 'invalid_speaker_code' ? 'Invalid speaker code.' : 'Not found.'}</p>;
  }
  if (!data) return <p>Not found.</p>;

  const isLive = online[slug] ?? data.channel.online;

  return (
    <main className="mx-auto max-w-md space-y-2 p-8">
      <h1 className="text-xl">{data.channel.name}</h1>
      <p>{data.event.name}</p>
      <p>role: {data.role}</p>
      <p>channel: {isLive ? 'live' : 'offline'}</p>
      <p className="text-xs">socket: {status}</p>
      {socketError ? <p>{socketMessage(socketError)}</p> : null}
    </main>
  );
}
