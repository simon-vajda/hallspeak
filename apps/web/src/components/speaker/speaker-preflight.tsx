import type { components } from '@linguacast/contract/openapi';
import { Mic } from 'lucide-react';
import { AppHeader } from '@/components/app-header';
import { ConnectionLine } from '@/components/connection-line';
import { LiveBadge } from '@/components/live-badge';
import { InputLevelPanel } from '@/components/speaker/input-level-panel';
import { ListenerPageLink } from '@/components/speaker/listener-page-link';
import { MicPanel } from '@/components/speaker/mic-panel';
import { TempThemeToggle } from '@/components/temp-theme-toggle';
import { Button } from '@/components/ui/button';
import type { AudioPreferences } from '@/lib/audio/preferences';
import type { useMicCapture } from '@/lib/audio/use-mic-capture';
import { formatPin } from '@/lib/format';
import type { SocketStatus } from '@/lib/use-socket';

type PublicChannel = components['schemas']['PublicChannel'];

export function SpeakerPreflight({
  eventName,
  pin,
  channel,
  speakerCode,
  mic,
  preferences,
  onPreferencesChange,
  canGoLive,
  onGoLive,
  status,
  socketError,
}: {
  eventName: string;
  pin: string;
  channel: PublicChannel;
  speakerCode: string;
  mic: ReturnType<typeof useMicCapture>;
  preferences: AudioPreferences;
  onPreferencesChange: (patch: Partial<AudioPreferences>) => void;
  canGoLive: boolean;
  onGoLive: () => void;
  status: SocketStatus;
  socketError: string | null;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <AppHeader
        right={
          <>
            <span className="text-meta text-muted-foreground">
              {eventName} · PIN {formatPin(pin)}
            </span>
            <TempThemeToggle />
          </>
        }
      />

      <main className="mx-auto flex w-full max-w-shell flex-1 flex-col px-gutter pt-6.5 pb-8.5 lg:px-10 lg:pt-11 lg:pb-12">
        <header>
          <div className="flex items-center justify-between gap-3">
            <LiveBadge live={false} showDot={false} label="Interpreter · off air" />
            <div className="-my-1 lg:hidden">
              <TempThemeToggle />
            </div>
          </div>
          <h1 className="mt-4 mb-1 text-screen lg:text-hero-lg">{channel.name}</h1>
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
            onPreferencesChange={onPreferencesChange}
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
                onClick={onGoLive}
                className="h-15.5 w-full gap-2.5 text-lg tracking-[-0.02em] shadow-[0_16px_40px] shadow-primary/35"
              >
                <Mic className="size-5 stroke-[2.25]" />
                Go live
              </Button>

              <p className="mt-5 text-center text-meta font-normal text-muted-foreground">
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
              <ListenerPageLink pin={pin} slug={channel.slug} className="mt-4" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
