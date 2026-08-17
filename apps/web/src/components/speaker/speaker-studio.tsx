import type { components } from '@linguacast/contract/openapi';
import { Mic, MicOff } from 'lucide-react';
import { useEffect, useState } from 'react';
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
import { useMicCapture } from '@/lib/audio/use-mic-capture';
import { formatPin } from '@/lib/format';
import type { SocketStatus } from '@/lib/use-socket';

type PublicChannel = components['schemas']['PublicChannel'];

// The go-live gate is a one-way latch, not a meter, so it polls rather than reading per frame.
const SIGNAL_POLL_MS = 200;

/**
 * Going live is client-local state: the button emits nothing, because the presence claim
 * already happened at the handshake. Until mediasoup lands, no copy here may claim that
 * anybody is hearing audio.
 */
export function SpeakerStudio({
  eventName,
  pin,
  channel,
  speakerCode,
  status,
  socketError,
}: {
  eventName: string;
  pin: string;
  channel: PublicChannel;
  speakerCode: string;
  /** Not read here: true from the handshake onwards, so it says nothing about this interpreter. */
  live: boolean;
  status: SocketStatus;
  socketError: string | null;
}) {
  const [isLive, setIsLive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  // Held and applied to nothing; see MicPanel for what each becomes once a producer exists.
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [autoGain, setAutoGain] = useState(false);
  const [gain, setGain] = useState(68);

  const mic = useMicCapture();
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

  if (isLive) {
    return (
      <OnAir
        channelName={channel.name}
        eventName={eventName}
        mic={mic}
        startedAt={startedAt}
        isMuted={isMuted}
        onToggleMute={() => setIsMuted((muted) => !muted)}
        onEnd={() => {
          setIsLive(false);
          setIsMuted(false);
          setStartedAt(null);
        }}
        noiseSuppression={noiseSuppression}
        onNoiseSuppressionChange={setNoiseSuppression}
        autoGain={autoGain}
        onAutoGainChange={setAutoGain}
        gain={gain}
        onGainChange={setGain}
        status={status}
        socketError={socketError}
      />
    );
  }

  const canGoLive = mic.deviceId !== null && heardSomething;

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
          {/* Off air is a claim about audio, and stays true until mediasoup carries any. */}
          <span className="inline-flex items-center rounded-full bg-secondary px-3.25 py-1.5 text-label text-muted-foreground uppercase">
            Interpreter · off air
          </span>
          <h1 className="mt-4 mb-1 text-screen lg:text-[44px] lg:leading-[1.03] lg:tracking-[-0.045em]">
            {channel.name}
          </h1>
          {/* The design pairs this with a waiting-listener count; nothing reports one yet. */}
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
            noiseSuppression={noiseSuppression}
            onNoiseSuppressionChange={setNoiseSuppression}
            autoGain={autoGain}
            onAutoGainChange={setAutoGain}
            gain={gain}
            onGainChange={setGain}
          />

          <div className="flex flex-1 flex-col gap-4 lg:flex-none lg:gap-4.5">
            <InputLevelPanel
              analyser={mic.analyser}
              note="Speak at your normal volume — aim to sit just under the peak mark. Nobody hears you until you go live."
            />

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
                  setIsLive(true);
                  setStartedAt(Date.now());
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
 * Nothing here talks to the server: going live and ending it move only local state. `On air`
 * is true of the channel from the handshake onwards, and no copy claims anyone is hearing
 * this microphone.
 */
function OnAir({
  channelName,
  eventName,
  mic,
  startedAt,
  isMuted,
  onToggleMute,
  onEnd,
  status,
  socketError,
  ...preferences
}: {
  channelName: string;
  eventName: string;
  mic: ReturnType<typeof useMicCapture>;
  /** `Date.now()` at the moment Go live was pressed. */
  startedAt: number | null;
  isMuted: boolean;
  onToggleMute: () => void;
  onEnd: () => void;
  noiseSuppression: boolean;
  onNoiseSuppressionChange: (on: boolean) => void;
  autoGain: boolean;
  onAutoGainChange: (on: boolean) => void;
  gain: number;
  onGainChange: (gain: number) => void;
  status: SocketStatus;
  socketError: string | null;
}) {
  const [confirming, setConfirming] = useState(false);
  const connected = status === 'connected';

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
          {/* The channel is still claimed while the socket is away, but unconfirmable. */}
          <LiveBadge live={connected} label={connected ? 'On air' : 'Reconnecting…'} />
          <span className="text-meta text-muted-foreground lg:hidden">{eventName}</span>
        </header>

        <h1 className="mt-4 text-screen lg:mt-3.5 lg:mb-7.5 lg:text-[40px] lg:leading-[1.03] lg:tracking-[-0.045em]">
          {channelName}
        </h1>

        <div className="mt-4.5 flex flex-1 flex-col gap-2.5 lg:mt-0 lg:grid lg:flex-none lg:grid-cols-[300px_1fr] lg:items-start lg:gap-x-8.5 lg:gap-y-4">
          <OnAirStats startedAt={startedAt} className="lg:col-start-2 lg:row-start-1" />

          <div className="flex flex-1 items-center justify-center py-4 lg:col-start-1 lg:row-span-3 lg:row-start-1 lg:flex-none lg:self-center lg:py-0">
            {/* The meter below is untouched, so the speaker still sees the mic work. */}
            <PlayTarget
              icon={isMuted ? <MicOff /> : <Mic />}
              label={isMuted ? 'Muted' : 'Mute'}
              variant={isMuted ? 'danger' : 'live'}
              rings={!isMuted}
              onClick={onToggleMute}
            />
          </div>

          {/* No note: pre-flight already said nobody hears you. */}
          <InputLevelPanel analyser={mic.analyser} className="lg:col-start-2 lg:row-start-2" />

          <AudioSettings mic={mic} {...preferences} className="lg:col-start-2 lg:row-start-3" />

          <div className="lg:col-start-1 lg:row-start-4">
            {(socketError || status !== 'connected') && (
              <ConnectionLine status={status} error={socketError} className="mb-2 text-center" />
            )}
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
