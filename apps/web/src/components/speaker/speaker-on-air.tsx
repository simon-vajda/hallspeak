import type {
  AnchoredListenerPoint,
  AnchoredResolution,
  AnchoredRow,
} from '@hallspeak/client-core/channel';
import { isLinkUp, type LinkState } from '@hallspeak/client-core/media';
import type { components } from '@hallspeak/contract/openapi';
import { Mic, MicOff } from 'lucide-react';
import { useLayoutEffect, useState } from 'react';
import { AppHeader } from '@/components/app-header';
import { ConnectionLine } from '@/components/connection-line';
import { PlayTarget } from '@/components/play-target';
import { AudioSettings } from '@/components/speaker/audio-settings';
import { EndBroadcastDialog } from '@/components/speaker/end-broadcast-dialog';
import { HandoverPrompt } from '@/components/speaker/handover-prompt';
import { InputLevelPanel } from '@/components/speaker/input-level-panel';
import { ListenerHistoryPanel } from '@/components/speaker/listener-history-panel';
import { ListenerPageLink } from '@/components/speaker/listener-page-link';
import { ListenerReports } from '@/components/speaker/listener-reports';
import { OnAirStats } from '@/components/speaker/on-air-stats';
import { ScreenAwakeNotice } from '@/components/speaker/screen-awake-notice';
import { StudioTitle } from '@/components/speaker/studio-title';
import { Button } from '@/components/ui/button';
import { VersionFooter } from '@/components/version-footer';
import type { AudioPreferences } from '@/lib/audio/preferences';
import type { useMicCapture } from '@/lib/audio/use-mic-capture';
import { useScreenWakeLock } from '@/lib/use-screen-wake-lock';
import { cn } from '@/lib/utils';
import { type BroadcastState, studioBadge } from './speaker-studio-state';

type PublicChannel = components['schemas']['PublicChannel'];

const TARGET_LABEL: Record<BroadcastState, string> = {
  'pre-flight': 'Mute',
  connecting: 'Connecting',
  live: 'Mute',
  muted: 'Muted',
  'handing-over': 'Mute',
  displaced: 'Mute',
};

export function SpeakerOnAir({
  channel,
  eventName,
  pin,
  mic,
  startedAt,
  listeners,
  listenerHistory,
  reports,
  reportResolution,
  reportsKnown,
  state,
  link,
  handoverPending,
  handoverExpiresAt,
  handoverBusy,
  handoverFailed,
  onHandOver,
  onToggleMute,
  onEnd,
  preferences,
  onPreferencesChange,
}: {
  channel: PublicChannel;
  eventName: string;
  pin: string;
  mic: ReturnType<typeof useMicCapture>;
  /** When the channel went on air, across every interpreter who has held it. */
  startedAt: number | null;
  listeners: number;
  /** This channel's recent counts, or undefined while none has been sent to this studio. */
  listenerHistory: AnchoredListenerPoint[] | undefined;
  reports: AnchoredRow[];
  reportResolution: AnchoredResolution | null;
  reportsKnown: boolean;
  state: BroadcastState;
  link: LinkState;
  /** A colleague has asked for the channel and is waiting on this interpreter. */
  handoverPending: boolean;
  handoverExpiresAt: number | null;
  handoverBusy: boolean;
  handoverFailed: boolean;
  onHandOver: () => void;
  onToggleMute: () => void;
  onEnd: () => void;
  preferences: AudioPreferences;
  onPreferencesChange: (patch: Partial<AudioPreferences>) => void;
}) {
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  const wakeLock = useScreenWakeLock();
  const [confirming, setConfirming] = useState(false);
  const isMuted = state === 'muted';
  const handingOver = state === 'handing-over';
  const badge = studioBadge(state, isLinkUp(link));

  const exit = ({ className, buttonClassName }: { className: string; buttonClassName: string }) => (
    <div className={cn('w-full flex-col items-center', className)}>
      <Button
        variant="destructive"
        onClick={() => setConfirming(true)}
        className={cn(
          'h-11 w-full rounded-full border-destructive-border text-sm font-semibold',
          buttonClassName,
        )}
      >
        End broadcast
      </Button>
      <ListenerPageLink pin={pin} slug={channel.slug} className="mt-3" />
    </div>
  );

  return (
    <div className="relative flex min-h-dvh flex-col">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-shell flex-1 flex-col px-gutter pt-4 pb-7.5 lg:px-10 lg:pt-11 lg:pb-12">
        {handoverPending || handingOver ? (
          <HandoverPrompt
            handingOver={handingOver}
            expiresAt={handoverExpiresAt}
            busy={handoverBusy}
            failed={handoverFailed}
            onHandOver={onHandOver}
            className="mb-4.5 lg:mb-7.5"
          />
        ) : null}

        <div className="flex flex-col lg:grid lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start lg:gap-x-8.5">
          {/* Sticky so the mute target stays in reach however far the panels beside it grow, but
              only where the whole stage fits: a stuck stage taller than the window hides End
              broadcast until the panels have scrolled to their end. */}
          <div className="flex flex-col items-center lg:top-[calc(var(--spacing-header)+--spacing(11))] lg:[@media(min-height:45rem)]:sticky">
            <StudioTitle eventName={eventName} name={channel.name} badge={badge} />
            <div className="mt-4.5 flex justify-center py-10 lg:mt-7">
              <PlayTarget
                icon={isMuted ? <MicOff /> : <Mic />}
                label={TARGET_LABEL[state]}
                variant={isMuted ? 'danger' : 'live'}
                // Narrower than the badge's `live`: the rings mean samples are moving, which a
                // muted producer is not doing.
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
            <ConnectionLine link={link} className="mt-2.5 w-full lg:mt-4" />
            {/* Rendered once per breakpoint rather than reordered: `display: none` takes the
                unused copy out of the tab order, so focus follows what is on screen. */}
            {exit({ className: 'mt-6 hidden lg:flex', buttonClassName: 'max-w-60' })}
          </div>

          <div className="mt-4.5 flex flex-col gap-2.5 lg:mt-0 lg:gap-4">
            <ScreenAwakeNotice status={wakeLock} />
            <ListenerReports rows={reports} resolution={reportResolution} known={reportsKnown} />
            <OnAirStats startedAt={startedAt} listeners={listeners} />
            <InputLevelPanel analyser={mic.analyser} muted={isMuted} />
            <AudioSettings
              mic={mic}
              preferences={preferences}
              onPreferencesChange={onPreferencesChange}
            />
            <ListenerHistoryPanel history={listenerHistory} />
          </div>
        </div>

        {exit({ className: 'mt-auto flex pt-8 lg:hidden', buttonClassName: 'sm:max-w-100' })}
      </main>

      <VersionFooter />

      <EndBroadcastDialog
        open={confirming}
        onOpenChange={setConfirming}
        handoverPending={handoverPending}
        onConfirm={() => {
          setConfirming(false);
          onEnd();
        }}
      />
    </div>
  );
}
