import type { components } from '@linguacast/contract/openapi';
import { Mic, MicOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ConnectionLine } from '@/components/guest/connection-line';
import { GuestHeader } from '@/components/guest/guest-header';
import { LiveDot } from '@/components/live-dot';
import { PlayTarget } from '@/components/play-target';
import { AudioSettings } from '@/components/speaker/audio-settings';
import { EndBroadcastDialog } from '@/components/speaker/end-broadcast-dialog';
import { InputLevelPanel } from '@/components/speaker/input-level-panel';
import { MicPanel } from '@/components/speaker/mic-panel';
import { OnAirStats } from '@/components/speaker/on-air-stats';
import { TempThemeToggle } from '@/components/temp-theme-toggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { levelStatus, rms } from '@/lib/audio/level';
import { useMicCapture } from '@/lib/audio/use-mic-capture';
import { formatPin } from '@/lib/format';
import type { SocketStatus } from '@/lib/use-socket';
import { cn } from '@/lib/utils';

type PublicChannel = components['schemas']['PublicChannel'];

// How often the go-live gate samples the analyser. It is a one-way latch, not a meter, so
// it runs on an interval rather than per frame — five reads a second is far more than a
// question answered once per session needs.
const SIGNAL_POLL_MS = 200;

/**
 * The interpreter's screen: pre-flight (`10f`, `10s`) and, once live, the on-air view
 * (`10g`) — one component with two renders, because everything the on-air view shows is
 * this component's state and the microphone it already holds.
 *
 * **Going live is client-local state.** Pressing the button emits nothing and claims
 * nothing: the presence claim happened at the handshake, which is why guests already see
 * this channel as live the moment the studio opens — before anyone has pressed anything.
 * That gap closes when the mediasoup produce call becomes what marks a channel live; until
 * then no copy on this screen may claim that anybody is hearing audio.
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
  /** The code from the speaker link; only its last four are ever shown. */
  speakerCode: string;
  /**
   * Whether guests see this channel as live. Deliberately not read here: it is already
   * true from the handshake, so it says nothing about whether this interpreter has
   * started — see the note above.
   */
  live: boolean;
  status: SocketStatus;
  socketError: string | null;
}) {
  const [isLive, setIsLive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  // Audio-processing preferences. Held here and persisted to nothing — see MicPanel for
  // what each becomes once the capture track feeds a producer.
  const [noiseSuppression, setNoiseSuppression] = useState(true);
  const [autoGain, setAutoGain] = useState(false);
  const [gain, setGain] = useState(68);

  const mic = useMicCapture();
  // Latched, never cleared: the button must not flicker back to disabled while someone
  // pauses between words.
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

      {/* The toggle is absolutely positioned over this bar's right edge, so the meta line
          reserves its width rather than sliding under it. */}
      <GuestHeader
        right={
          <span className="mr-11 text-meta text-muted-foreground">
            {eventName} · PIN {formatPin(pin)}
          </span>
        }
      />

      <main className="flex flex-1 flex-col px-gutter pt-6.5 pb-8.5 lg:px-10 lg:pt-11 lg:pb-12">
        <header>
          {/* Off air is a claim about audio, and it stays true until mediasoup carries any. */}
          <span className="inline-flex items-center rounded-full bg-secondary px-3.25 py-1.5 text-label text-muted-foreground uppercase">
            Interpreter · off air
          </span>
          <h1 className="mt-4 mb-1 text-screen lg:text-[44px] lg:leading-[1.03] lg:tracking-[-0.045em]">
            {channel.name}
          </h1>
          {/* The design pairs the event name with a waiting-listener count. There is no
              count to show — nothing reports one — so the line is the event alone. */}
          <p className="text-sm text-muted-foreground lg:mb-8">{eventName}</p>
        </header>

        <div className="mt-6 flex flex-1 flex-col gap-4 lg:mt-0 lg:grid lg:grid-cols-2 lg:items-start lg:gap-5.5">
          <MicPanel
            status={mic.status}
            error={mic.error}
            devices={mic.devices}
            deviceId={mic.deviceId}
            onSelectDevice={mic.selectDevice}
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

            {/* Bottom-anchored on a phone, where the action owns the last band of the
                screen; in the desktop column it simply follows the panel. */}
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
                // 62px and 18px are this button's own, larger than the pill size the rest
                // of the app uses: it is the only action on the screen.
                // The glow is the design's, written on the `primary` role rather than its hex.
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
 * The on-air view (`10g`, `10u`–`10w`).
 *
 * **Nothing here talks to the server.** Going live and ending it both move only the studio's
 * own state — no socket event is emitted, no presence claim is made or released — so the
 * badge says `On air`, which is true of the channel from the handshake onwards, and no copy
 * claims that anyone is hearing this microphone. Ending returns to pre-flight while the
 * socket stays exactly as it was.
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
  /** `Date.now()` at the moment Go live was pressed; the elapsed clock counts from it. */
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

      <GuestHeader
        right={<span className="mr-11 text-meta text-muted-foreground">{eventName}</span>}
      />

      <main className="flex flex-1 flex-col px-gutter pt-6 pb-7.5 lg:px-10 lg:pt-11 lg:pb-12">
        <header className="flex items-center justify-between gap-3 lg:justify-start">
          {/* Dropped to its muted treatment while the socket is away: the channel is still
              claimed, but nothing here can confirm it until the connection is back. */}
          <Badge
            className={cn(
              'h-auto gap-1.75 rounded-full px-3.25 py-1.5 text-label uppercase',
              connected
                ? 'bg-live-muted text-live-foreground'
                : 'bg-secondary text-muted-foreground',
            )}
          >
            <LiveDot size="sm" tone={connected ? 'live' : 'offline'} />
            {connected ? 'On air' : 'Reconnecting…'}
          </Badge>
          <span className="text-meta text-muted-foreground lg:hidden">{eventName}</span>
        </header>

        <h1 className="mt-4 text-screen lg:mt-3.5 lg:mb-7.5 lg:text-[40px] lg:leading-[1.03] lg:tracking-[-0.045em]">
          {channelName}
        </h1>

        {/* One tree at both widths: a stack on a phone, and from `lg` the design's two
            columns, with the circle spanning the right column's three rows and the quiet
            end-broadcast button under it. */}
        <div className="mt-4.5 flex flex-1 flex-col gap-2.5 lg:mt-0 lg:grid lg:flex-none lg:grid-cols-[300px_1fr] lg:items-start lg:gap-x-8.5 lg:gap-y-4">
          <OnAirStats startedAt={startedAt} className="lg:col-start-2 lg:row-start-1" />

          <div className="flex flex-1 items-center justify-center py-4 lg:col-start-1 lg:row-span-3 lg:row-start-1 lg:flex-none lg:self-center lg:py-0">
            {/* Muting swaps the fill and the label and stops the rings — the meter below is
                deliberately untouched, so the speaker can still see the mic working. */}
            <PlayTarget
              icon={isMuted ? <MicOff /> : <Mic />}
              label={isMuted ? 'Muted' : 'Mute'}
              variant={isMuted ? 'danger' : 'live'}
              rings={!isMuted}
              onClick={onToggleMute}
            />
          </div>

          {/* No note here: the pre-flight line under the bar says nobody hears you yet. */}
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
