import type { components } from '@linguacast/contract/openapi';
import { Link } from '@tanstack/react-router';
import { ChevronLeft, Loader2, Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AppHeader } from '@/components/app-header';
import { ConnectionLine } from '@/components/connection-line';
import { ChannelStrip } from '@/components/guest/channel-strip';
import { LiveBadge } from '@/components/live-badge';
import { PlayTarget } from '@/components/play-target';
import { TempThemeToggle } from '@/components/temp-theme-toggle';
import { formatPin } from '@/lib/format';
import { connectionState } from '@/lib/media/stats';
import { useMedia } from '@/lib/media/use-media';
import type { SocketStatus } from '@/lib/use-socket';
import { cn } from '@/lib/utils';
import type { SocketClient } from '@/socket/client';
import { listenState, playTargetLabel, showsRings, statusNote } from './listen-state';

type PublicChannel = components['schemas']['PublicChannel'];

// Larger than `text-screen`: the channel name is the only thing on the page.
const TITLE =
  'text-[40px] leading-[1.05] font-semibold tracking-[-0.04em] lg:text-[46px] lg:leading-[1.02] lg:tracking-[-0.045em]';

/**
 * Armed is the guest's one gesture; everything after it is automatic. `isPlaying` means a
 * resumed consumer exists — samples are arriving — which is what `PlayTarget`'s rings
 * claim, so it is derived rather than toggled on the tap.
 */
export function ListenerRoom({
  eventName,
  pin,
  channel,
  channels,
  live,
  socket,
  status,
  socketError,
}: {
  eventName: string;
  pin: string;
  channel: PublicChannel;
  /** Every channel of the event. Empty until its query lands. */
  channels: PublicChannel[];
  live: boolean;
  socket: SocketClient | null;
  status: SocketStatus;
  socketError: string | null;
}) {
  const [armed, setArmed] = useState(false);
  const media = useMedia(socket);
  const audio = useRef<HTMLAudioElement | null>(null);

  const connected = status === 'connected';
  const isPlaying = media.state.consumers[channel.slug] !== undefined;
  const state = listenState({
    armed,
    isPlaying,
    live,
    socketConnected: connected,
    mediaTrouble: media.health === 'trouble',
  });

  /**
   * Arming creates nothing on either side; a producer's arrival is what starts the audio,
   * whether that is now or an hour from now. The gate is the guest's own gesture and
   * never a signal that only arrives once audio is already flowing — gating it on one is
   * the deadlock recorded in docs/solutions/ui-bugs.
   */
  const { startConsuming, stopConsuming } = media;
  useEffect(() => {
    if (!armed || !connected || !live || isPlaying) return;

    let cancelled = false;
    void startConsuming(channel.slug)
      .then((track) => {
        if (cancelled) return;
        const element = audio.current;
        if (!element) return;
        element.srcObject = new MediaStream([track]);
        // Started under the arming gesture's context, so this resolves rather than
        // rejecting on autoplay policy.
        void element.play().catch(() => {});
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [armed, connected, live, isPlaying, channel.slug, startConsuming]);

  // The interpreter dropping closes the consumer. Armed is untouched: it is the guest's
  // gesture, and re-asking for it is exactly what R26 exists to prevent.
  useEffect(() => {
    if (live || !isPlaying) return;
    void stopConsuming(channel.slug);
  }, [live, isPlaying, channel.slug, stopConsuming]);

  const connection = connectionState({
    socketConnected: connected,
    mediaTrouble: media.health === 'trouble',
    live,
    stats: media.stats,
  });

  const meta = `${eventName} · PIN ${formatPin(pin)}`;
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
            // A handshake rejection is terminal: socket.io does not retry it.
            status === 'error'
              ? 'Disconnected'
              : !connected
                ? 'Reconnecting…'
                : !live
                  ? 'Waiting for the interpreter'
                  : isPlaying
                    ? 'Listening'
                    : 'Interpreter on air'
          }
        />

        <h1 className={cn('mt-4 mb-10 lg:mt-4.5 lg:mb-10', TITLE)}>{channel.name}</h1>

        {/* Never disabled on `live`: arming before anyone is on air is the whole point. */}
        <PlayTarget
          icon={<PlayIcon state={state} />}
          label={playTargetLabel(state)}
          rings={showsRings(state)}
          // Subdued while armed and waiting, so it does not read as an untapped control.
          className={cn(state === 'waiting' && 'opacity-70')}
          onClick={() => {
            if (!armed) {
              setArmed(true);
              return;
            }
            setArmed(false);
            void stopConsuming(channel.slug);
            audio.current?.pause();
          }}
        />

        {armed || socketError ? (
          <ConnectionLine
            status={status}
            error={socketError}
            connection={connection}
            className="mt-9.5 lg:mt-9"
          />
        ) : (
          <p className="mt-9.5 max-w-80 text-sm leading-normal text-muted-foreground lg:mt-9">
            {statusNote(state)}
          </p>
        )}

        {/* The element the consumer's track plays through; it renders nothing itself. */}
        {/* biome-ignore lint/a11y/useMediaCaption: interpreted speech has no track to caption. */}
        <audio ref={audio} autoPlay className="hidden" />
      </main>

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

/** Waiting gets its own mark, so armed-and-waiting cannot be mistaken for untapped. */
function PlayIcon({ state }: { state: ReturnType<typeof listenState> }) {
  if (state === 'playing') return <Pause className="fill-current" />;
  if (state === 'idle') return <Play className="fill-current" />;
  return <Loader2 className="animate-spin motion-reduce:animate-none" />;
}
