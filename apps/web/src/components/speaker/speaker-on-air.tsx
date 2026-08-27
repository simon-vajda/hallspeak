import type { components } from '@linguacast/contract/openapi';
import { Mic, MicOff } from 'lucide-react';
import { useState } from 'react';
import { AppHeader } from '@/components/app-header';
import { ConnectionLine } from '@/components/connection-line';
import { LiveBadge } from '@/components/live-badge';
import { PlayTarget } from '@/components/play-target';
import { AudioSettings } from '@/components/speaker/audio-settings';
import { EndBroadcastDialog } from '@/components/speaker/end-broadcast-dialog';
import { InputLevelPanel } from '@/components/speaker/input-level-panel';
import { ListenerPageLink } from '@/components/speaker/listener-page-link';
import { OnAirStats } from '@/components/speaker/on-air-stats';
import { TempThemeToggle } from '@/components/temp-theme-toggle';
import { Button } from '@/components/ui/button';
import type { AudioPreferences } from '@/lib/audio/preferences';
import type { useMicCapture } from '@/lib/audio/use-mic-capture';
import type { ConnectionState } from '@/lib/media/stats';
import type { SocketStatus } from '@/lib/use-socket';
import type { BroadcastState } from './speaker-studio-state';

type PublicChannel = components['schemas']['PublicChannel'];

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

export function SpeakerOnAir({
  channel,
  eventName,
  pin,
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
  channel: PublicChannel;
  eventName: string;
  pin: string;
  mic: ReturnType<typeof useMicCapture>;
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
      <AppHeader
        right={
          <>
            <span className="text-meta text-muted-foreground">{eventName}</span>
            <TempThemeToggle />
          </>
        }
      />

      <main className="mx-auto flex w-full max-w-shell flex-1 flex-col px-gutter pt-6 pb-7.5 lg:px-10 lg:pt-11 lg:pb-12">
        <header className="flex items-center justify-between gap-3 lg:justify-start">
          <LiveBadge live={onAir} label={BADGE_LABEL[state]} />
          <div className="-my-1 flex min-w-0 items-center gap-3 lg:hidden">
            <span className="truncate text-meta text-muted-foreground">{eventName}</span>
            <TempThemeToggle />
          </div>
        </header>

        <h1 className="mt-4 text-screen lg:mt-3.5 lg:mb-7.5 lg:text-hero">{channel.name}</h1>

        <div className="mt-4.5 flex flex-1 flex-col gap-2.5 lg:mt-0 lg:grid lg:flex-none lg:grid-cols-[300px_1fr] lg:items-start lg:gap-x-8.5 lg:gap-y-4">
          <OnAirStats
            startedAt={startedAt}
            listeners={listeners}
            className="lg:col-start-2 lg:row-start-1"
          />
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-10 lg:col-start-1 lg:row-span-3 lg:row-start-1 lg:flex-none lg:self-center lg:py-0">
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

          <div className="mt-4 lg:col-start-1 lg:row-start-4 lg:mt-0">
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
            <ListenerPageLink pin={pin} slug={channel.slug} className="mt-2" />
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
