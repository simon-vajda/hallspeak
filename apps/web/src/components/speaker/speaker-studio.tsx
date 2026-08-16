import type { components } from '@linguacast/contract/openapi';
import type { SocketStatus } from '@/lib/use-socket';

type PublicChannel = components['schemas']['PublicChannel'];

/**
 * PLACEHOLDER. The props are the studio's real contract — the route resolves all of this
 * and passes it down — but the body is deliberately minimal: a later unit replaces it with
 * the designed screen (pre-flight, level meter, go-live, mute). Nothing here is meant to
 * survive that.
 */
export function SpeakerStudio({
  eventName,
  pin,
  channel,
  live,
  status,
  socketError,
}: {
  eventName: string;
  pin: string;
  channel: PublicChannel;
  live: boolean;
  status: SocketStatus;
  socketError: string | null;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-2 px-gutter text-center">
      <h1 className="text-screen">{channel.name}</h1>
      <p className="text-sm text-muted-foreground">
        {eventName} · PIN {pin}
      </p>
      <p className="text-note text-muted-foreground">
        The speaker studio is not built yet. Channel is {live ? 'on air' : 'off air'}; socket is{' '}
        {status}.{socketError ? ` ${socketError}` : ''}
      </p>
    </main>
  );
}
