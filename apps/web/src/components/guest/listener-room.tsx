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
import { isLinkUp, resolveLinkState } from '@/lib/media/link-state';
import { consumerPlan, mayAttachConsumerTrack } from '@/lib/media/media-state';
import { isSuperseded, useMedia } from '@/lib/media/use-media';
import type { SocketStatus } from '@/lib/use-socket';
import { cn } from '@/lib/utils';
import type { SocketClient } from '@/socket/client';
import {
  badgeHasLiveDot,
  badgeLabel,
  type ListenIntentState,
  listenActionState,
  playTargetLabel,
  reconcileListenIntent,
  statusNote,
} from './listen-state';

type PublicChannel = components['schemas']['PublicChannel'];

// Larger than `text-screen`: the channel name is the only thing on the page.
const TITLE = 'text-hero lg:text-hero-lg';

/**
 * `isPlaying` means a resumed consumer exists — samples are arriving — which is what
 * `PlayTarget`'s rings claim, so it is derived rather than toggled on the tap.
 */
export function ListenerRoom({
  eventName,
  pin,
  channel,
  channels,
  live,
  muted,
  closeReason,
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
  closeReason?: 'ended' | 'dropped';
  socket: SocketClient | null;
  status: SocketStatus;
  hasConnected: boolean;
  socketError: string | null;
}) {
  const [playback, setPlayback] = useState<ListenIntentState>({
    intent: 'idle',
    holdDeadline: null,
  });
  const media = useMedia(socket);
  const audio = useRef<HTMLAudioElement | null>(null);
  const output = useAudioOutput();
  const volume = useAudioVolume(audio);
  useAudioSink(audio, output.deviceId, output.clearSelection);

  const link = resolveLinkState({
    socketStatus: status,
    hasConnected,
    mediaHealth: media.health,
    stats: media.stats,
    // The guest's own stored request, not the reconciled one: reconciling needs the link, and
    // a guest who has not asked for audio has no media leg for the line to report on.
    mediaWanted: playback.intent !== 'idle',
  });
  const linkConnected = isLinkUp(link);
  const isPlaying = media.state.consumers[channel.slug] !== undefined;
  const playingSnapshotRef = useRef({ slug: channel.slug, isPlaying });
  const wasPlaying =
    playingSnapshotRef.current.slug === channel.slug && playingSnapshotRef.current.isPlaying;
  useLayoutEffect(() => {
    playingSnapshotRef.current = { slug: channel.slug, isPlaying };
  }, [channel.slug, isPlaying]);
  const now = Date.now();
  const resolvedPlayback = reconcileListenIntent(playback, {
    live,
    ...(closeReason === undefined ? {} : { closeReason }),
    linkConnected,
    wasPlaying,
    now,
  });
  const badgeInput = {
    live,
    muted,
    holding: resolvedPlayback.intent === 'holding',
    linkConnected,
  };
  const actionState = listenActionState({
    ...resolvedPlayback,
    live,
    isPlaying,
    linkConnected,
    now,
  });

  useLayoutEffect(() => {
    setPlayback((current) => {
      const next = reconcileListenIntent(current, {
        live,
        ...(closeReason === undefined ? {} : { closeReason }),
        linkConnected,
        wasPlaying,
        now: Date.now(),
      });
      return sameIntent(current, next) ? current : next;
    });
  }, [live, closeReason, linkConnected, wasPlaying]);

  useEffect(() => {
    if (playback.intent !== 'holding' || playback.holdDeadline === null) {
      return;
    }

    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const now = Date.now();
      const remaining = playback.holdDeadline === null ? 0 : playback.holdDeadline - now;
      if (remaining > 0) {
        timer = setTimeout(tick, remaining);
        return;
      }
      setPlayback((current) => {
        const next = reconcileListenIntent(current, {
          live,
          ...(closeReason === undefined ? {} : { closeReason }),
          linkConnected,
          wasPlaying,
          now,
        });
        return sameIntent(current, next) ? current : next;
      });
    };
    timer = setTimeout(tick, Math.max(0, playback.holdDeadline - Date.now()));
    return () => clearTimeout(timer);
  }, [playback.intent, playback.holdDeadline, live, closeReason, linkConnected, wasPlaying]);

  /**
   * Producer existence is safe to gate on because it arrives independently of the guest's
   * gesture. This is not the deadlock where the signal can only arrive after the control
   * has already been pressed.
   *
   * What to open and what to close is `consumerPlan`'s decision, not this effect's: a
   * switch, an interpreter dropping and a hold overlap, and deciding them
   * separately here is how the previous channel's consumer gets left open.
   */
  const { startConsuming, stopConsuming } = media;
  const consumers = media.state.consumers;
  const activeSlug =
    resolvedPlayback.intent === 'playing' || resolvedPlayback.intent === 'holding'
      ? channel.slug
      : null;
  const online = live && linkConnected;
  const playbackIntentRef = useRef({ activeSlug, online });
  useLayoutEffect(() => {
    playbackIntentRef.current = { activeSlug, online };
  }, [activeSlug, online]);

  useEffect(() => {
    const plan = consumerPlan({ consumers, activeSlug, online });
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
          playbackIntentRef.current.activeSlug === requestedSlug &&
          playbackIntentRef.current.online &&
          !isSuperseded(cause)
        ) {
          console.error('media: could not listen', cause);
        }
      });
  }, [consumers, activeSlug, online, startConsuming, stopConsuming]);

  const meta = `${eventName} · PIN ${formatPin(pin)}`;
  const note =
    socketError ??
    statusNote({
      ...badgeInput,
      isPlaying,
      ...(closeReason === undefined ? {} : { closeReason }),
    });

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
        <LiveBadge live={badgeHasLiveDot(badgeInput)} label={badgeLabel(badgeInput)} />

        <h1 className={cn('mt-4 mb-10 lg:mt-4.5 lg:mb-10', TITLE)}>{channel.name}</h1>

        {/* A listener can start only while a Producer is available. */}
        <div className="py-10">
          <PlayTarget
            icon={<PlayIcon state={actionState} />}
            label={playTargetLabel(actionState)}
            rings={actionState === 'playing'}
            className={cn(actionState === 'holding' && 'disabled:opacity-100')}
            disabled={actionState === 'unavailable' || actionState === 'holding'}
            onClick={() => {
              if (actionState === 'ready') {
                setPlayback({ intent: 'playing', holdDeadline: null });
                return;
              }
              if (actionState === 'playing') {
                setPlayback({ intent: 'idle', holdDeadline: null });
                audio.current?.pause();
              }
            }}
          />
        </div>

        <ConnectionLine link={link} className="mt-9.5 lg:mt-9" />

        {note && (
          <p className="mt-3.5 max-w-80 text-sm leading-normal text-muted-foreground">{note}</p>
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

function PlayIcon({ state }: { state: ReturnType<typeof listenActionState> }) {
  if (state === 'playing') {
    return <Pause className="fill-current" />;
  }
  if (state === 'holding') {
    return <Loader2 className="animate-spin motion-reduce:animate-none" />;
  }
  return <Play className="fill-current" />;
}

function sameIntent(left: ListenIntentState, right: ListenIntentState): boolean {
  return left.intent === right.intent && left.holdDeadline === right.holdDeadline;
}
