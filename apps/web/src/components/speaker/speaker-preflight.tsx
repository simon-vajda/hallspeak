import type { LinkState } from '@linguacast/client-core/media';
import type { components } from '@linguacast/contract/openapi';
import { Mic } from 'lucide-react';
import { ConnectionLine } from '@/components/connection-line';
import { HandoverAlert } from '@/components/speaker/handover-alert';
import { HandoverCountdown, useHandoverRemaining } from '@/components/speaker/handover-countdown';
import { InputLevelPanel } from '@/components/speaker/input-level-panel';
import { ListenerPageLink } from '@/components/speaker/listener-page-link';
import { MicPanel } from '@/components/speaker/mic-panel';
import { StudioChrome } from '@/components/speaker/studio-chrome';
import { StudioTitle } from '@/components/speaker/studio-title';
import { Button } from '@/components/ui/button';
import { VersionFooter } from '@/components/version-footer';
import type { AudioPreferences } from '@/lib/audio/preferences';
import type { useMicCapture } from '@/lib/audio/use-mic-capture';
import {
  CANCEL_REQUEST,
  HANDOVER_FAILED,
  PREFLIGHT_CHECKING_NOTE,
  preflightActionLabel,
  preflightAlert,
} from '@/lib/handover-copy';
import { type PreflightAction, studioBadge } from './speaker-studio-state';

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
  link,
  action,
  handoverBusy,
  handoverFailed,
  onRequestHandover,
  onCancelHandover,
  onTakeOver,
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
  link: LinkState;
  /** What this studio may do about the channel right now, decided by the server's snapshot. */
  action: PreflightAction;
  handoverBusy: boolean;
  handoverFailed: boolean;
  onRequestHandover: () => void;
  onCancelHandover: () => void;
  onTakeOver: () => void;
}) {
  const remaining = useHandoverRemaining(action.type === 'waiting' ? action.expiresAt : null);
  const alert = preflightAlert(action.type);
  // Every variant that puts this studio on air keeps the microphone gate: a handover is
  // still a Go live, and going live with nothing captured hands over silence.
  const gated = !canGoLive;
  return (
    <div className="relative flex min-h-dvh flex-col">
      <StudioChrome eventName={eventName} pin={pin} />

      <main className="mx-auto flex w-full max-w-shell flex-1 flex-col px-gutter pt-4 pb-8.5 lg:px-10 lg:pt-11 lg:pb-12">
        {/* One region for every holder state, mounted throughout: the alert and the note each
            mount already holding their text, which screen readers do not announce. */}
        <p aria-live="polite" className="sr-only">
          {alert
            ? `${alert.title}. ${alert.note}`
            : action.type === 'unknown'
              ? PREFLIGHT_CHECKING_NOTE
              : ''}
        </p>
        {alert ? (
          <HandoverAlert
            tone="warn"
            title={alert.title}
            note={alert.note}
            live={false}
            className="mb-6"
          />
        ) : null}
        <StudioTitle name={channel.name} badge={studioBadge('pre-flight', true)} />

        <div className="mt-6 flex flex-1 flex-col gap-4 lg:mt-8 lg:grid lg:grid-cols-2 lg:items-start lg:gap-5.5">
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
            <div className="mt-6 lg:mt-0">
              {/* Only while the line has something to report: pre-flight wants no media, so
                  `idle` renders an empty reserved slot above Go live and nothing else. */}
              {(link.kind === 'connecting' ||
                link.kind === 'reconnecting' ||
                link.kind === 'lost') && (
                <ConnectionLine link={link} className="mb-3.5 text-center" />
              )}

              {action.type === 'unknown' ? (
                <p aria-hidden className="mb-3.5 text-center text-note text-muted-foreground">
                  {PREFLIGHT_CHECKING_NOTE}
                </p>
              ) : null}

              {action.type === 'waiting' ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-15.5 w-full items-center justify-center gap-3 rounded-full border border-border border-dashed text-base font-semibold text-muted-foreground">
                    {preflightActionLabel(action.type)}
                    {remaining === null ? null : (
                      <HandoverCountdown remainingMs={remaining} className="text-base" />
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="action"
                    disabled={handoverBusy}
                    onClick={onCancelHandover}
                  >
                    {CANCEL_REQUEST}
                  </Button>
                </div>
              ) : (
                <Button
                  size="pill"
                  disabled={
                    gated ||
                    handoverBusy ||
                    action.type === 'pending-elsewhere' ||
                    action.type === 'unknown'
                  }
                  onClick={
                    action.type === 'ready'
                      ? onRequestHandover
                      : action.type === 'take-over'
                        ? onTakeOver
                        : onGoLive
                  }
                  className="h-15.5 w-full gap-2.5 text-lg tracking-[-0.02em] shadow-[0_16px_40px] shadow-primary/35"
                >
                  <Mic className="size-5 stroke-[2.25]" />
                  {preflightActionLabel(action.type)}
                </Button>
              )}

              {handoverFailed ? (
                <p role="alert" className="mt-3 text-center text-note text-destructive">
                  {HANDOVER_FAILED}
                </p>
              ) : null}

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

      <VersionFooter />
    </div>
  );
}
