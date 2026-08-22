import type { components } from '@linguacast/contract/openapi';
import { Mic, MicOff } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppHeader } from '@/components/app-header';
import { ConnectionLine } from '@/components/connection-line';
import { LiveBadge } from '@/components/live-badge';
import { PlayTarget } from '@/components/play-target';
import { AudioSettings } from '@/components/speaker/audio-settings';
import { EndBroadcastDialog } from '@/components/speaker/end-broadcast-dialog';
import { InputLevelPanel } from '@/components/speaker/input-level-panel';
import { MicPanel } from '@/components/speaker/mic-panel';
import { OnAirStats } from '@/components/speaker/on-air-stats';
import { TempThemeToggle } from '@/components/temp-theme-toggle';
import { Button } from '@/components/ui/button';
import { levelStatus, rms } from '@/lib/audio/level';
import { useAudioPreferences } from '@/lib/audio/use-audio-preferences';
import { useMicCapture } from '@/lib/audio/use-mic-capture';
import { formatPin } from '@/lib/format';
import { type ConnectionState, connectionState } from '@/lib/media/stats';
import { isSuperseded, useMedia } from '@/lib/media/use-media';
import type { SocketStatus } from '@/lib/use-socket';
import type { SocketClient } from '@/socket/client';
import {
  type AudioPreferences,
  type BroadcastState,
  broadcastState,
  type EndReason,
  onReconnect,
} from './live-state';

type PublicChannel = components['schemas']['PublicChannel'];

// The go-live gate is a one-way latch, not a meter, so it polls rather than reading per frame.
const SIGNAL_POLL_MS = 200;

/**
 * On air means a producer exists, never that the button was pressed: the badge must not
 * claim anyone is hearing this microphone before the server has the audio.
 */
export function SpeakerStudio({
  eventName,
  pin,
  channel,
  speakerCode,
  listeners,
  socket,
  status,
  socketError,
}: {
  eventName: string;
  pin: string;
  channel: PublicChannel;
  speakerCode: string;
  /** Guests currently receiving this channel's audio. */
  listeners: number;
  socket: SocketClient | null;
  status: SocketStatus;
  socketError: string | null;
}) {
  const [goLivePressed, setGoLivePressed] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [displaced, setDisplaced] = useState(false);
  const [lastEnd, setLastEnd] = useState<EndReason | null>(null);
  const [recoveredSilently, setRecoveredSilently] = useState(false);

  const { preferences, setPreferences } = useAudioPreferences();
  const mic = useMicCapture(preferences);
  const media = useMedia(socket);

  const hasProducer = media.state.producerId !== null;
  const state = broadcastState({
    goLivePressed,
    hasProducer,
    isMuted,
    displaced,
    recoveredSilently,
  });

  const outputTrack = mic.outputTrack;
  // Destructured, not the whole hook result: `media` is a fresh object every render, so
  // closing over it would churn this callback's identity and re-fire the effect below on
  // every render rather than when its guards actually change.
  const { startProducing, replaceProducerTrack } = media;
  // What the producer is currently transmitting, so a capture rebuild is detectable.
  const producedTrack = useRef<MediaStreamTrack | null>(null);

  const produce = useCallback(
    async (paused: boolean) => {
      if (!outputTrack) return;
      try {
        await startProducing(channel.slug, outputTrack, paused);
        producedTrack.current = outputTrack;
      } catch (cause) {
        // A reset landed mid-negotiation; its own renegotiation takes over from here.
        if (!isSuperseded(cause)) console.error('media: could not go live', cause);
      }
    },
    [startProducing, outputTrack, channel.slug],
  );

  /**
   * Changing microphone rebuilds the capture graph, which closes the AudioContext the
   * previous track belonged to. Left alone, the producer keeps that dead track and the
   * channel stays live while transmitting silence — so the new track is swapped in.
   * Covers an unplugged microphone falling back to the default, not just a deliberate
   * change.
   */
  useEffect(() => {
    if (!hasProducer || !outputTrack) return;
    if (producedTrack.current === outputTrack) return;

    producedTrack.current = outputTrack;
    void replaceProducerTrack(outputTrack).catch((cause) => {
      console.error('media: could not switch microphone', cause);
    });
  }, [hasProducer, outputTrack, replaceProducerTrack]);

  /**
   * The server ends a session by disconnecting it, and Socket.IO does not reconnect after
   * one. Reaching this means the channel is no longer ours — another device took the
   * speaker link, or the code behind it was regenerated.
   */
  useEffect(() => {
    if (!socket) return;
    const onDisconnect = (reason: string) => {
      if (reason === 'io server disconnect') setDisplaced(true);
    };
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('disconnect', onDisconnect);
    };
  }, [socket]);

  // Marks the drop, so the reconnect below can tell it from a broadcast we ended on purpose.
  const wasConnected = useRef(false);
  useEffect(() => {
    if (status === 'connected') {
      wasConnected.current = true;
      return;
    }
    if (status === 'connecting' && wasConnected.current && goLivePressed && lastEnd === null) {
      setLastEnd('dropped');
    }
  }, [status, goLivePressed, lastEnd]);

  /**
   * The whole of R44: after an involuntary drop the client rebuilds and re-produces on its
   * own, but paused, so the interpreter's one action is to unmute. After a deliberate end
   * it does nothing — a broadcast somebody chose to stop must not restart itself because
   * the Wi-Fi blinked.
   */
  useEffect(() => {
    if (status !== 'connected' || hasProducer || !outputTrack) return;
    if (onReconnect({ goLivePressed, lastEnd, displaced }).type !== 're-produce') return;

    let cancelled = false;
    void produce(true).then(() => {
      if (cancelled) return;
      setIsMuted(true);
      // Only a recovery reads as back-from-drop; the first Go live is an ordinary start.
      if (lastEnd === 'dropped') setRecoveredSilently(true);
      setLastEnd(null);
    });
    return () => {
      cancelled = true;
    };
  }, [status, hasProducer, outputTrack, goLivePressed, lastEnd, displaced, produce]);
  // Never cleared: the button must not flicker back to disabled during a pause between words.
  const [heardSomething, setHeardSomething] = useState(false);

  useEffect(() => {
    const analyser = mic.analyser;
    if (!analyser || heardSomething) return;

    const frame = new Uint8Array(analyser.fftSize);
    const timer = setInterval(() => {
      analyser.getByteTimeDomainData(frame);
      if (levelStatus(Math.min(rms(frame), 1)) !== 'quiet') setHeardSomething(true);
    }, SIGNAL_POLL_MS);

    return () => clearInterval(timer);
  }, [mic.analyser, heardSomething]);

  // A suspended AudioContext reports a flat line, so `heardSomething` never latches and Go
  // live stays disabled. Go live is the one control that cannot be the resuming gesture.
  const { suspended, resume } = mic;
  useEffect(() => {
    if (!suspended) return;

    window.addEventListener('pointerdown', resume);
    window.addEventListener('keydown', resume);
    return () => {
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('keydown', resume);
    };
  }, [suspended, resume]);

  if (state === 'displaced') {
    return <Displaced channelName={channel.name} eventName={eventName} />;
  }

  if (goLivePressed) {
    return (
      <OnAir
        channelName={channel.name}
        eventName={eventName}
        mic={mic}
        startedAt={startedAt}
        listeners={listeners}
        state={state}
        connection={connectionState({
          socketConnected: status === 'connected',
          mediaTrouble: media.health === 'trouble',
          live: hasProducer,
          paused: state === 'muted' || state === 'back-from-drop',
          stats: media.stats,
        })}
        onToggleMute={() => {
          const next = !isMuted;
          setIsMuted(next);
          setRecoveredSilently(false);
          void media.setProducerPaused(next);
        }}
        onEnd={() => {
          // Recorded before the close, so the reconnect effect cannot read it as a drop.
          setLastEnd('deliberate');
          setGoLivePressed(false);
          setIsMuted(false);
          setRecoveredSilently(false);
          setStartedAt(null);
          void media.stopProducing();
        }}
        preferences={preferences}
        onPreferencesChange={setPreferences}
        status={status}
        socketError={socketError}
      />
    );
  }

  const canGoLive = mic.deviceId !== null && heardSomething && mic.outputTrack !== null;

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="absolute top-3.5 right-gutter z-10 lg:top-4 lg:right-10">
        <TempThemeToggle />
      </div>

      {/* `mr-11` reserves room for the toggle absolutely positioned over this bar's right edge. */}
      <AppHeader
        right={
          <span className="mr-11 text-meta text-muted-foreground">
            {eventName} · PIN {formatPin(pin)}
          </span>
        }
      />

      <main className="flex flex-1 flex-col px-gutter pt-6.5 pb-8.5 lg:px-10 lg:pt-11 lg:pb-12">
        <header>
          <span className="inline-flex items-center rounded-full bg-secondary px-3.25 py-1.5 text-label text-muted-foreground uppercase">
            Interpreter · off air
          </span>
          <h1 className="mt-4 mb-1 text-screen lg:text-[44px] lg:leading-[1.03] lg:tracking-[-0.045em]">
            {channel.name}
          </h1>
          <p className="text-sm text-muted-foreground lg:mb-8">{eventName}</p>
        </header>

        <div className="mt-6 flex flex-1 flex-col gap-4 lg:mt-0 lg:grid lg:grid-cols-2 lg:items-start lg:gap-5.5">
          <MicPanel
            status={mic.status}
            error={mic.error}
            notice={mic.notice}
            devices={mic.devices}
            deviceId={mic.deviceId}
            onSelectDevice={mic.selectDevice}
            onRetry={mic.retry}
            preferences={preferences}
            onPreferencesChange={setPreferences}
          />

          <div className="flex flex-1 flex-col gap-4 lg:flex-none lg:gap-4.5">
            <InputLevelPanel analyser={mic.analyser} />

            <div className="mt-auto pt-8 lg:mt-0 lg:pt-0">
              {(socketError || status !== 'connected') && (
                <ConnectionLine
                  status={status}
                  error={socketError}
                  className="mb-3.5 text-center"
                />
              )}

              <Button
                size="pill"
                disabled={!canGoLive}
                onClick={() => {
                  setGoLivePressed(true);
                  setLastEnd(null);
                  setStartedAt(Date.now());
                  void produce(false);
                }}
                // Larger than the shared `pill` size: it is the only action on the screen.
                className="h-15.5 w-full gap-2.5 text-[18px] tracking-[-0.02em] shadow-[0_16px_40px] shadow-primary/35"
              >
                <Mic className="size-5 stroke-[2.25]" />
                Go live
              </Button>

              <p className="mt-3 text-center text-meta font-normal text-muted-foreground">
                {canGoLive
                  ? 'Wear headphones — without them the room’s speakers feed back into your mic.'
                  : mic.deviceId === null
                    ? 'Pick a microphone to go live.'
                    : mic.suspended
                      ? 'This browser starts the meter on your first tap — tap anywhere, then say something.'
                      : 'Say something — the meter has to move before you can go live.'}
                <br />
                Speaker link · code ends {speakerCode.slice(-4)}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * Every claim on this screen hangs off `state`. Only `live` means audio is reaching
 * anyone; `connecting` has no producer yet and `back-from-drop` is silent until the
 * interpreter unmutes, which is the one thing that screen has to ask for.
 */
function OnAir({
  channelName,
  eventName,
  mic,
  startedAt,
  listeners,
  state,
  connection,
  onToggleMute,
  onEnd,
  preferences,
  onPreferencesChange,
  status,
  socketError,
}: {
  channelName: string;
  eventName: string;
  mic: ReturnType<typeof useMicCapture>;
  /** `Date.now()` at the moment Go live was pressed. */
  startedAt: number | null;
  listeners: number;
  state: BroadcastState;
  connection: ConnectionState;
  onToggleMute: () => void;
  onEnd: () => void;
  preferences: AudioPreferences;
  onPreferencesChange: (patch: Partial<AudioPreferences>) => void;
  status: SocketStatus;
  socketError: string | null;
}) {
  const [confirming, setConfirming] = useState(false);
  const isMuted = state === 'muted' || state === 'back-from-drop';
  const onAir = state === 'live';

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="absolute top-3.5 right-gutter z-10 lg:top-4 lg:right-10">
        <TempThemeToggle />
      </div>

      <AppHeader
        right={<span className="mr-11 text-meta text-muted-foreground">{eventName}</span>}
      />

      <main className="flex flex-1 flex-col px-gutter pt-6 pb-7.5 lg:px-10 lg:pt-11 lg:pb-12">
        <header className="flex items-center justify-between gap-3 lg:justify-start">
          {/* `On air` is a claim about audio, so only a live producer earns it. */}
          <LiveBadge live={onAir} label={BADGE_LABEL[state]} />
          <span className="text-meta text-muted-foreground lg:hidden">{eventName}</span>
        </header>

        <h1 className="mt-4 text-screen lg:mt-3.5 lg:mb-7.5 lg:text-[40px] lg:leading-[1.03] lg:tracking-[-0.045em]">
          {channelName}
        </h1>

        <div className="mt-4.5 flex flex-1 flex-col gap-2.5 lg:mt-0 lg:grid lg:flex-none lg:grid-cols-[300px_1fr] lg:items-start lg:gap-x-8.5 lg:gap-y-4">
          <OnAirStats
            startedAt={startedAt}
            listeners={listeners}
            className="lg:col-start-2 lg:row-start-1"
          />

          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-8 lg:col-start-1 lg:row-span-3 lg:row-start-1 lg:flex-none lg:self-center lg:py-0">
            {/* The meter below is untouched, so the speaker still sees the mic work. */}
            <PlayTarget
              icon={isMuted ? <MicOff /> : <Mic />}
              label={TARGET_LABEL[state]}
              variant={isMuted ? 'danger' : 'live'}
              rings={onAir}
              onClick={onToggleMute}
            />
            {state === 'back-from-drop' && (
              <p className="max-w-64 text-center text-meta font-normal text-muted-foreground">
                Your connection dropped and came back. You are muted — unmute to carry on.
              </p>
            )}
          </div>

          <InputLevelPanel analyser={mic.analyser} className="lg:col-start-2 lg:row-start-2" />

          <AudioSettings
            mic={mic}
            preferences={preferences}
            onPreferencesChange={onPreferencesChange}
            className="lg:col-start-2 lg:row-start-3"
          />

          <div className="lg:col-start-1 lg:row-start-4">
            <ConnectionLine
              status={status}
              error={socketError}
              connection={connection}
              className="mb-2"
            />
            <Button
              variant="ghost"
              onClick={() => setConfirming(true)}
              className="h-10.5 w-full rounded-full text-sm font-semibold text-destructive hover:bg-destructive-muted hover:text-destructive"
            >
              End broadcast
            </Button>
          </div>
        </div>
      </main>

      <EndBroadcastDialog
        open={confirming}
        onOpenChange={setConfirming}
        onConfirm={() => {
          setConfirming(false);
          onEnd();
        }}
      />
    </div>
  );
}

const BADGE_LABEL: Record<BroadcastState, string> = {
  'pre-flight': 'Off air',
  connecting: 'Connecting…',
  live: 'On air',
  muted: 'Muted',
  'back-from-drop': 'Back — but muted',
  displaced: 'Off air',
};

const TARGET_LABEL: Record<BroadcastState, string> = {
  'pre-flight': 'Mute',
  connecting: 'Connecting',
  live: 'Mute',
  muted: 'Muted',
  'back-from-drop': 'Unmute',
  displaced: 'Mute',
};

/**
 * A takeover is a dead end by design, not a failure to retry: reclaiming automatically is
 * exactly the alternation loop that visible displacement exists to prevent. So this offers
 * the way back rather than taking it — reload once the other device has stopped.
 */
function Displaced({ channelName, eventName }: { channelName: string; eventName: string }) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="absolute top-3.5 right-gutter z-10 lg:top-4 lg:right-10">
        <TempThemeToggle />
      </div>

      <AppHeader
        right={<span className="mr-11 text-meta text-muted-foreground">{eventName}</span>}
      />

      <main className="flex flex-1 flex-col items-center justify-center px-gutter pb-16 text-center lg:px-10">
        <span className="inline-flex items-center rounded-full bg-secondary px-3.25 py-1.5 text-label text-muted-foreground uppercase">
          Interpreter · off air
        </span>
        {/* The wire carries no reason with the disconnect, so the copy names both causes
            rather than asserting the one it cannot tell apart. */}
        <h1 className="mt-4 mb-2 text-screen lg:text-screen-lg">{channelName} was handed over</h1>
        <p className="max-w-100 text-sm text-muted-foreground">
          This session stopped — either another device opened the same speaker link, or the
          organiser changed it. It will not take the channel back on its own. Reload this page to
          try again, and ask the organiser if the link no longer works.
        </p>
      </main>
    </div>
  );
}
