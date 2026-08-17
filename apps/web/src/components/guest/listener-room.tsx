import type { components } from '@linguacast/contract/openapi';
import { Link } from '@tanstack/react-router';
import { ChevronLeft, Pause, Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppHeader } from '@/components/app-header';
import { ConnectionLine } from '@/components/connection-line';
import { ChannelStrip } from '@/components/guest/channel-strip';
import { LiveBadge } from '@/components/live-badge';
import { PlayTarget } from '@/components/play-target';
import { TempThemeToggle } from '@/components/temp-theme-toggle';
import { formatPin } from '@/lib/format';
import type { SocketStatus } from '@/lib/use-socket';
import { cn } from '@/lib/utils';

type PublicChannel = components['schemas']['PublicChannel'];

// Larger than `text-screen`: the channel name is the only thing on the page.
const TITLE =
  'text-[40px] leading-[1.05] font-semibold tracking-[-0.04em] lg:text-[46px] lg:leading-[1.02] lg:tracking-[-0.045em]';

/**
 * `isPlaying` is client-local state and nothing else: the gesture that will start an
 * `AudioContext` and a mediasoup consumer has nowhere to go yet. Once it does, `isPlaying`
 * means "samples are arriving", which is what `PlayTarget`'s rings claim.
 */
export function ListenerRoom({
  eventName,
  pin,
  channel,
  channels,
  live,
  status,
  socketError,
}: {
  eventName: string;
  pin: string;
  channel: PublicChannel;
  /** Every channel of the event. Empty until its query lands. */
  channels: PublicChannel[];
  live: boolean;
  status: SocketStatus;
  socketError: string | null;
}) {
  const [isPlaying, setIsPlaying] = useState(false);

  // The interpreter dropping off ends playback: the selector already shows this as waiting.
  useEffect(() => {
    if (!live) setIsPlaying(false);
  }, [live]);

  const meta = `${eventName} · PIN ${formatPin(pin)}`;
  // While the socket is away, liveness is last known rather than current, so the badge stops
  // claiming it.
  const connected = status === 'connected';
  const onAir = live && connected;

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="absolute top-3.5 right-gutter z-10 lg:top-4 lg:right-10">
        <TempThemeToggle />
      </div>

      {/* `mr-11` reserves room for the toggle absolutely positioned over this bar's right edge. */}
      <AppHeader right={<span className="mr-11 text-meta text-muted-foreground">{meta}</span>} />
      <ChannelStrip channels={channels} currentSlug={channel.slug} pin={pin} />

      {/* The phone's way back to the selector; from `lg` the channel strip is it. */}
      <div className="flex items-center gap-3 px-gutter pt-4.5 lg:hidden">
        <Link
          to="/events/$pin"
          params={{ pin }}
          aria-label="Back to channels"
          className="flex size-9.5 items-center justify-center rounded-full bg-secondary focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
        >
          <ChevronLeft className="size-4.5 stroke-[2.25]" />
        </Link>
        <span className="text-meta text-muted-foreground">{meta}</span>
      </div>

      <main className="flex flex-1 flex-col items-center justify-center px-8 text-center lg:px-10 lg:py-13">
        <LiveBadge
          live={onAir}
          label={
            !live
              ? 'Waiting for the interpreter'
              : // A handshake rejection is terminal: socket.io does not retry it.
                status === 'error'
                ? 'Disconnected'
                : !connected
                  ? 'Reconnecting…'
                  : isPlaying
                    ? 'Listening'
                    : 'Interpreter on air'
          }
        />

        <h1 className={cn('mt-4 mb-10 lg:mt-4.5 lg:mb-10', TITLE)}>{channel.name}</h1>

        <PlayTarget
          icon={isPlaying ? <Pause className="fill-current" /> : <Play className="fill-current" />}
          label={isPlaying ? 'Pause' : 'Tap to listen'}
          rings={isPlaying}
          disabled={!live}
          onClick={() => setIsPlaying((playing) => !playing)}
        />

        {isPlaying || socketError ? (
          <ConnectionLine status={status} error={socketError} className="mt-9.5 lg:mt-9" />
        ) : (
          <p className="mt-9.5 max-w-80 text-sm leading-normal text-muted-foreground lg:mt-9">
            {live
              ? 'Headphones recommended, so the room stays quiet for everyone else.'
              : 'This channel starts on its own as soon as its interpreter connects.'}
          </p>
        )}
      </main>

      {/* The design's output-device card is not built: it needs a playing element. */}
      <div className="mt-auto px-gutter pb-8.5 text-center lg:pb-16.5">
        <Link
          to="/events/$pin"
          params={{ pin }}
          className="rounded-full text-note font-semibold text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4"
        >
          Switch channel
        </Link>
      </div>
    </div>
  );
}
