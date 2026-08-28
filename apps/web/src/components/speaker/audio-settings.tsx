import { Mic } from 'lucide-react';
import { AudioSurface } from '@/components/audio-surface';
import { GainSlider } from '@/components/speaker/gain-slider';
import { MicPanel } from '@/components/speaker/mic-panel';
import type { AudioPreferences } from '@/lib/audio/preferences';
import type { useMicCapture } from '@/lib/audio/use-mic-capture';

type MicHandle = ReturnType<typeof useMicCapture>;

type Props = {
  mic: MicHandle;
  preferences: AudioPreferences;
  onPreferencesChange: (patch: Partial<AudioPreferences>) => void;
  className?: string;
};

export function AudioSettings({ className, ...props }: Props) {
  const label = props.mic.devices.find((d) => d.deviceId === props.mic.deviceId)?.label;

  return (
    <AudioSurface
      icon={<Mic className="size-4.5 shrink-0 stroke-[2.25]" />}
      label={label ?? 'Microphone'}
      secondaryLabel="Audio settings"
      title="Audio"
      className={className}
    >
      <SettingsBody {...props} />
    </AudioSurface>
  );
}

/**
 * The same body under both surfaces. `inSettings` hides the card's own slider, which is
 * desktop-only there, so the one below is the only copy rather than a second one.
 */
function SettingsBody({ mic, preferences, onPreferencesChange }: Omit<Props, 'className'>) {
  return (
    <>
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
        inSettings
      />

      {/* The rule the card used to draw: without it the gain reads as part of the row above. */}
      <GainSlider
        gain={preferences.gain}
        onGainChange={(gain) => onPreferencesChange({ gain })}
        disabled={preferences.autoGain}
        className="mt-3.5 border-t border-border pt-3.5"
      />

      <p className="mt-3.5 text-note text-muted-foreground">
        You stay on air while this is open. Switching device drops about a second of audio, so do it
        between sentences.
      </p>
    </>
  );
}
