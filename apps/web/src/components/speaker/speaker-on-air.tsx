import type { AnchoredResolution, AnchoredRow } from '@linguacast/client-core/channel';
import { isLinkUp, type LinkState } from '@linguacast/client-core/media';
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
import { ListenerReports } from '@/components/speaker/listener-reports';
import { OnAirStats } from '@/components/speaker/on-air-stats';
import { TempThemeToggle } from '@/components/temp-theme-toggle';
import { Button } from '@/components/ui/button';
import type { AudioPreferences } from '@/lib/audio/preferences';
import type { useMicCapture } from '@/lib/audio/use-mic-capture';
import type { BroadcastState } from './speaker-studio-state';

type PublicChannel = components['schemas']['PublicChannel'];

const BADGE_LABEL: Record<BroadcastState, string> = {
  'pre-flight': 'Off air',
  connecting: 'Going live…',
  live: 'On air',
  muted: 'On air · muted',
  displaced: 'Off air',
};

const TARGET_LABEL: Record<BroadcastState, string> = {
  'pre-flight': 'Mute',
  connecting: 'Connecting',
  live: 'Mute',
  muted: 'Muted',
  displaced: 'Mute',
};

export function SpeakerOnAir({
  channel,
  eventName,
  pin,
  mic,
  startedAt,
  listeners,
  reports,
  reportResolution,
  reportsKnown,
  state,
  link,
  onToggleMute,
  onEnd,
  preferences,
  onPreferencesChange,
}: {
  channel: PublicChannel;
  eventName: string;
  pin: string;
  mic: ReturnType<typeof useMicCapture>;
  startedAt: number | null;
  listeners: number;
  reports: AnchoredRow[];
  reportResolution: AnchoredResolution | null;
  reportsKnown: boolean;
  state: BroadcastState;
  link: LinkState;
  onToggleMute: () => void;
  onEnd: () => void;
  preferences: AudioPreferences;
  onPreferencesChange: (patch: Partial<AudioPreferences>) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const isMuted = state === 'muted';
  // A producer this screen still holds locally is not reaching anyone while signalling is
  // down, so the badge falls back to the pre-producer wording rather than claiming the air.
  const hasProducer = state === 'live' || state === 'muted';
  const onAir = hasProducer && isLinkUp(link);
  const badgeLabel = hasProducer && !onAir ? BADGE_LABEL.connecting : BADGE_LABEL[state];

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
          <LiveBadge live={onAir} label={badgeLabel} />
          <div className="-my-1 flex min-w-0 items-center gap-3 lg:hidden">
            <span className="truncate text-meta text-muted-foreground">{eventName}</span>
            <TempThemeToggle />
          </div>
        </header>

        <h1 className="mt-4 text-screen lg:mt-3.5 lg:mb-7.5 lg:text-hero">{channel.name}</h1>

        <div className="mt-4.5 flex flex-1 flex-col gap-2.5 lg:mt-0 lg:grid lg:flex-none lg:grid-cols-[300px_1fr] lg:items-start xl:grid-cols-[minmax(0,1fr)_340px] lg:gap-x-8.5 lg:gap-y-4">
          {/* Separate desktop grid rows keep growing reports from moving the controls. */}
          <div className="contents xl:col-start-1 xl:row-start-1 xl:grid xl:grid-cols-[300px_minmax(0,1fr)] xl:items-start xl:gap-x-8.5 xl:gap-y-4">
            <OnAirStats
              startedAt={startedAt}
              listeners={listeners}
              className="order-4 lg:order-none lg:col-start-2 lg:row-start-1"
            />
            <div className="order-1 flex flex-1 flex-col items-center justify-center gap-4 py-10 lg:order-none lg:col-start-1 lg:row-span-3 lg:row-start-1 lg:flex-none lg:self-center lg:py-0">
              <PlayTarget
                icon={isMuted ? <MicOff /> : <Mic />}
                label={TARGET_LABEL[state]}
                variant={isMuted ? 'danger' : 'live'}
                // Narrower than `onAir`: the rings mean samples are moving, which a muted
                // producer is not doing. The badge dot is what widens to cover both.
                rings={state === 'live'}
                // Only before a producer exists. A dropped socket must not take the mute with
                // it: `producer.pause()` is local and stops the audio on its own, so an
                // interpreter who needs to cut a hot mic can always do it, and the failed
                // server call leaves them muted rather than undoing it.
                disabled={state === 'connecting'}
                // The dashed rim is this screen's affordance, not the shared primitive's, and
                // the design leaves the fill at full strength behind it.
                className="disabled:border-dashed disabled:border-border disabled:opacity-100"
                onClick={onToggleMute}
              />
            </div>

            {/* Phone: directly under the connection line, the one block whose contents change,
              growing downward into what was already below the fold. From `xl` it takes a
              column of its own; between `lg` and `xl` it sits at the foot of the readout
              column, because three columns need 1040px of content box and `lg` gives 944. */}
            <ListenerReports
              rows={reports}
              resolution={reportResolution}
              known={reportsKnown}
              variant="phone"
              className="order-3 lg:hidden"
            />

            <InputLevelPanel
              analyser={mic.analyser}
              muted={isMuted}
              className="order-5 lg:order-none lg:col-start-2 lg:row-start-2"
            />
            <AudioSettings
              mic={mic}
              preferences={preferences}
              onPreferencesChange={onPreferencesChange}
              className="order-6 lg:order-none lg:col-start-2 lg:row-start-3"
            />

            <div className="contents lg:order-none lg:col-start-1 lg:row-start-4 lg:block">
              <ConnectionLine link={link} className="order-2 mb-2 lg:order-none" />
              <Button
                variant="ghost"
                onClick={() => setConfirming(true)}
                className="order-7 mt-4 h-10.5 w-full rounded-full text-sm font-semibold text-destructive hover:bg-destructive-muted hover:text-destructive lg:mt-0"
              >
                End broadcast
              </Button>
              <ListenerPageLink pin={pin} slug={channel.slug} className="order-8 mt-2" />
            </div>
          </div>

          {/* From `lg` the panel is always present, empty state included: the column has the
              room, and a slot that comes and goes would move what the interpreter watches. */}
          <ListenerReports
            rows={reports}
            resolution={reportResolution}
            known={reportsKnown}
            className="hidden lg:order-none lg:col-start-2 lg:row-start-4 lg:block xl:col-start-2 xl:row-start-1"
          />
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
