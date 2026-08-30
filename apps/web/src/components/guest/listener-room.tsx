import type { components } from '@linguacast/contract/openapi';
import { Link } from '@tanstack/react-router';
import { ChevronLeft, Loader2, Pause, Play } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppHeader } from '@/components/app-header';
import { ConnectionLine } from '@/components/connection-line';
import { ChannelStrip } from '@/components/guest/channel-strip';
import { ListenerAudioSettings } from '@/components/guest/listener-audio-settings';
import { LiveBadge } from '@/components/live-badge';
import { PlayTarget } from '@/components/play-target';
import { TempThemeToggle } from '@/components/temp-theme-toggle';
import { useAudioOutput } from '@/lib/audio/use-audio-output';
import { useAudioSink } from '@/lib/audio/use-audio-sink';
import { useAudioVolume } from '@/lib/audio/use-audio-volume';
import { formatPin } from '@/lib/format';
import { resolveLinkState } from '@/lib/media/link-state';
import { consumerPlan, mayAttachConsumerTrack } from '@/lib/media/media-state';
import { isSuperseded, useMedia } from '@/lib/media/use-media';
import type { SocketStatus } from '@/lib/use-socket';
import { cn } from '@/lib/utils';
import type { SocketClient } from '@/socket/client';
import {
  badgeLabel,
  listenActionState,
  listenState,
  playTargetLabel,
  showsRings,
  statusNote,
} from './listen-state';

type PublicChannel = components['schemas']['PublicChannel'];

// Larger than `text-screen`: the channel name is the only thing on the page.
const TITLE = 'text-hero lg:text-hero-lg';

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
  muted,
  socket,
  status,
  hasConnected,
  socketError,
}: {
  eventName: string;
  pin: string;
  channel: PublicChannel;
  /** Every channel of the event. Empty until its query lands. */
  channels: PublicChannel[];
  live: boolean;
  /** Socket-authoritative; null while an online REST seed is reconciled. */
  muted: boolean | null;
  socket: SocketClient | null;
  status: SocketStatus;
  hasConnected: boolean;
  socketError: string | null;
}) {
  const [armed, setArmed] = useState(false);
  const media = useMedia(socket);
  const audio = useRef<HTMLAudioElement | null>(null);
  const output = useAudioOutput();
  const volume = useAudioVolume(audio);
  useAudioSink(audio, output.deviceId, output.clearSelection);

  const connected = status === 'connected';
  const isPlaying = media.state.consumers[channel.slug] !== undefined;
  const state = listenState({
    terminal: status === 'error',
    armed,
    isPlaying,
    live,
    muted,
    socketConnected: connected,
    mediaTrouble: media.health === 'trouble',
  });
  const actionState = listenActionState({
    armed,
    isPlaying,
    terminal: status === 'error',
  });

  /**
   * Arming creates nothing on either side; a producer's arrival is what starts the audio,
   * whether that is now or an hour from now. The gate is the guest's own gesture and
   * never a signal that only arrives once audio is already flowing — gating it on one is
   * the deadlock recorded in docs/solutions/ui-bugs.
   *
   * What to open and what to close is `consumerPlan`'s decision, not this effect's: a
   * switch, an interpreter dropping and arming early overlap, and deciding them
   * separately here is how the previous channel's consumer gets left open.
   */
  const { startConsuming, stopConsuming } = media;
  const consumers = media.state.consumers;
  const armedSlug = armed ? channel.slug : null;
  const online = live && connected;
  const playbackIntentRef = useRef({ armedSlug, online });
  useLayoutEffect(() => {
    playbackIntentRef.current = { armedSlug, online };
  }, [armedSlug, online]);

  useEffect(() => {
    const plan = consumerPlan({ consumers, armedSlug, online });
    for (const slug of plan.close) {
      void stopConsuming(slug);
    }
    if (!plan.consume) {
      return;
    }

    const requestedSlug = plan.consume;
    void startConsuming(requestedSlug)
      .then((track) => {
        if (
          !mayAttachConsumerTrack({
            requestedSlug,
            ...playbackIntentRef.current,
            trackEnded: track.readyState === 'ended',
          })
        ) {
          return;
        }
        const element = audio.current;
        if (!element) {
          return;
        }
        element.srcObject = new MediaStream([track]);
        void element
          .play()
          .catch((cause) => console.error('media: could not start audio playback', cause));
      })
      .catch((cause) => {
        // Swallowed silently, a failed consume left the screen claiming it was waiting.
        if (
          playbackIntentRef.current.armedSlug === requestedSlug &&
          playbackIntentRef.current.online &&
          !isSuperseded(cause)
        ) {
          console.error('media: could not listen', cause);
        }
      });
  }, [consumers, armedSlug, online, startConsuming, stopConsuming]);

  const link = resolveLinkState({
    socketStatus: status,
    hasConnected,
    mediaHealth: media.health,
    stats: media.stats,
  });

  const meta = `${eventName} · PIN ${formatPin(pin)}`;
  const onAir = live && connected && muted === false;

  return (
    <div className="relative flex min-h-dvh flex-col">
      <AppHeader
        right={
          <>
            <span className="text-meta text-muted-foreground">{meta}</span>
            <TempThemeToggle />
          </>
        }
      />
      <ChannelStrip channels={channels} currentSlug={channel.slug} pin={pin} />

      {/* The phone's way back to the selector; from `lg` the channel strip is it. */}
      <div className="mx-auto flex w-full max-w-shell items-center gap-3 px-gutter pt-4.5 lg:hidden">
        <Link
          to="/events/$pin"
          params={{ pin }}
          aria-label="Back to channels"
          className="flex size-9.5 items-center justify-center rounded-full bg-secondary focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
        >
          <ChevronLeft className="size-4.5 stroke-[2.25]" />
        </Link>
        <span className="flex-1 truncate text-meta text-muted-foreground">{meta}</span>
        {/* In the row rather than floated over it, so it centres on the back button. */}
        <TempThemeToggle />
      </div>

      <main className="mx-auto flex w-full max-w-shell flex-1 flex-col items-center justify-center px-8 text-center lg:px-10 lg:py-13">
        <LiveBadge live={onAir} label={badgeLabel(state)} />

        <h1 className={cn('mt-4 mb-10 lg:mt-4.5 lg:mb-10', TITLE)}>{channel.name}</h1>

        {/* Never disabled on `live`: arming before anyone is on air is the whole point. */}
        <div className="py-10">
          <PlayTarget
            icon={<PlayIcon state={actionState} />}
            label={playTargetLabel(actionState)}
            rings={showsRings(state)}
            // Subdued while armed and waiting, so it does not read as an untapped control.
            className={cn(actionState === 'waiting' && 'opacity-70')}
            // Un-arming is enough to close the consumer: the plan above sees no armed
            // channel and closes whatever is open.
            disabled={actionState === 'ended'}
            onClick={() => {
              setArmed((wasArmed) => !wasArmed);
              audio.current?.pause();
            }}
          />
        </div>

        {armed || socketError ? (
          <ConnectionLine link={link} className="mt-9.5 lg:mt-9" />
        ) : (
          <p className="mt-9.5 max-w-80 text-sm leading-normal text-muted-foreground lg:mt-9">
            {statusNote(state)}
          </p>
        )}

        {/* The element the consumer's track plays through; it renders nothing itself. */}
        {/* biome-ignore lint/a11y/useMediaCaption: interpreted speech has no track to caption. */}
        <audio ref={audio} autoPlay className="hidden" />
      </main>

      <div className="mx-auto mt-auto flex w-full max-w-shell flex-col items-center gap-5 px-gutter pb-8.5 text-center lg:pb-16.5">
        <ListenerAudioSettings output={output} volume={volume} className="max-w-105" />
        <Link
          to="/events/$pin"
          params={{ pin }}
          className="rounded-full text-note font-semibold text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
        >
          Switch channel
        </Link>
      </div>
    </div>
  );
}

/** Waiting gets its own mark, so armed-and-waiting cannot be mistaken for untapped. */
function PlayIcon({ state }: { state: ReturnType<typeof listenActionState> }) {
  if (state === 'playing') {
    return <Pause className="fill-current" />;
  }
  if (state === 'idle') {
    return <Play className="fill-current" />;
  }
  return <Loader2 className="animate-spin motion-reduce:animate-none" />;
}
