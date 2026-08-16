import type { components } from '@linguacast/contract/openapi';
import { Link } from '@tanstack/react-router';
import { ChevronLeft, Pause, Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ChannelStrip } from '@/components/guest/channel-strip';
import { ConnectionLine } from '@/components/guest/connection-line';
import { GuestHeader } from '@/components/guest/guest-header';
import { LiveDot } from '@/components/live-dot';
import { PlayTarget } from '@/components/play-target';
import { TempThemeToggle } from '@/components/temp-theme-toggle';
import { Badge } from '@/components/ui/badge';
import { formatPin } from '@/lib/format';
import type { SocketStatus } from '@/lib/use-socket';
import { cn } from '@/lib/utils';

type PublicChannel = components['schemas']['PublicChannel'];

// 40px/46px is this screen's own title size — larger than `text-screen`, because the
// channel name is the only thing on the page and the design sets it as the whole view.
const TITLE =
  'text-[40px] leading-[1.05] font-semibold tracking-[-0.04em] lg:text-[46px] lg:leading-[1.02] lg:tracking-[-0.045em]';

const BADGE = 'h-auto gap-1.75 rounded-full px-3.25 py-1.5 text-label uppercase';

/**
 * The listener's channel screen: the tap gate (`10c`) and the playing state (`10d`/`10e`,
 * `10r`), which are the same layout with a different control.
 *
 * `isPlaying` is **client-local state and nothing else**. Pressing the target emits no
 * socket event and moves no audio: the gesture that will start the `AudioContext` and
 * subscribe the mediasoup consumer has nowhere to go yet, so today it only flips this
 * boolean. When mediasoup lands, `isPlaying` stops meaning "the guest pressed play" and
 * starts meaning "samples are arriving" — which is also what `PlayTarget`'s rings claim,
 * and why they are bound to it.
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
  /** Every channel of the event, liveness already resolved. Empty until its query lands. */
  channels: PublicChannel[];
  live: boolean;
  status: SocketStatus;
  socketError: string | null;
}) {
  const [isPlaying, setIsPlaying] = useState(false);

  // The interpreter dropping off ends playback for everyone listening to them. The selector
  // already models this channel as waiting, and the room has to agree with it.
  useEffect(() => {
    if (!live) setIsPlaying(false);
  }, [live]);

  const meta = `${eventName} · PIN ${formatPin(pin)}`;
  // Liveness is last known, not current, while the socket is away — so the badge stops
  // claiming it. The channel is still live as far as anyone knows; we just cannot say so.
  const connected = status === 'connected';
  const onAir = live && connected;

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="absolute top-3.5 right-gutter z-10 lg:top-4 lg:right-10">
        <TempThemeToggle />
      </div>

      {/* The theme toggle is absolutely positioned over this bar's right edge, so the meta
          line reserves its width rather than sliding under it. */}
      <GuestHeader right={<span className="mr-11 text-meta text-muted-foreground">{meta}</span>} />
      <ChannelStrip channels={channels} currentSlug={channel.slug} pin={pin} />

      {/* The phone's way back to the selector; from `lg` the channel strip is that. */}
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
        <Badge
          className={cn(
            BADGE,
            onAir ? 'bg-live-muted text-live-foreground' : 'bg-secondary text-muted-foreground',
          )}
        >
          <LiveDot size="sm" tone={onAir ? 'live' : 'offline'} />
          {!live
            ? 'Waiting for the interpreter'
            : !connected
              ? 'Reconnecting…'
              : isPlaying
                ? 'Listening'
                : 'Interpreter on air'}
        </Badge>

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

      {/* The design's output-device card sat above this line; it is not built, because
          picking an output needs a playing element to move. Its space simply collapses. */}
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
