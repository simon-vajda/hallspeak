import { Mic } from 'lucide-react';
import type { ReactNode } from 'react';
import { MICRO_LABEL } from '@/components/micro-label';
import { GainSlider } from '@/components/speaker/gain-slider';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { AudioDevice } from '@/lib/audio/devices';
import type { AudioPreferences } from '@/lib/audio/preferences';
import type { MicStatus } from '@/lib/audio/use-mic-capture';
import { cn } from '@/lib/utils';

const ROW = 'mt-3.5 flex items-center gap-3.5 border-t border-border pt-3.5';

/**
 * Noise suppression, echo cancellation and auto gain are `MediaTrackConstraints` on the
 * capture track; the manual gain is a `GainNode` on the graph feeding the producer. All four
 * apply to the live capture rather than re-opening the device, so changing one mid-broadcast
 * is silent.
 */
export function MicPanel({
  status,
  error,
  notice,
  devices,
  deviceId,
  onSelectDevice,
  onRetry,
  preferences,
  onPreferencesChange,
  inSettings = false,
  className,
}: {
  status: MicStatus;
  error: string | null;
  /** A fallback the hook already made, shown under a picker that still works. */
  notice: string | null;
  devices: AudioDevice[];
  deviceId: string | null;
  onSelectDevice: (deviceId: string) => void;
  onRetry: () => void;
  preferences: AudioPreferences;
  onPreferencesChange: (patch: Partial<AudioPreferences>) => void;
  /** Rendered inside the audio-settings surface, which supplies the gain slider itself. */
  inSettings?: boolean;
  className?: string;
}) {
  // Terminal cases render copy instead of the picker: an empty `Select` says nothing about why.
  const blocked = status === 'denied' || status === 'unsupported';
  const empty = status === 'ready' && devices.length === 0;

  return (
    <section
      className={cn(
        // Not a card inside the settings surface: nesting one there would inset these rows
        // further than the gain slider under them. `min-w-0` lets the device name truncate
        // rather than setting a min-content width the surface has to grow to.
        inSettings ? 'min-w-0' : 'rounded-lg bg-secondary px-5 py-4.5 lg:p-panel',
        className,
      )}
    >
      <h2 className={MICRO_LABEL}>Microphone</h2>

      {blocked || empty ? (
        <MicUnavailable
          message={error ?? 'No microphone was found. Connect one, then try again.'}
          inSettings={inSettings}
          onRetry={onRetry}
        />
      ) : (
        <>
          <Select
            items={devices.map((device) => ({ label: device.label, value: device.deviceId }))}
            value={deviceId}
            onValueChange={(value) => {
              if (value) {
                onSelectDevice(value);
              }
            }}
            disabled={devices.length === 0}
          >
            {/* The trigger's height is a `data-[size]` variant, so a plain `h-11` loses on
                specificity and the override has to be written at the same weight. */}
            <SelectTrigger className="mt-2.25 w-full min-w-0 gap-2.5 rounded-full border-border bg-background px-4 font-semibold text-sm data-[size=default]:h-11 lg:mt-2.5 lg:px-4.5 lg:data-[size=default]:h-11.5">
              <Mic className="size-4.25 stroke-[2.25]" />
              <SelectValue placeholder="Opening the microphone…" />
            </SelectTrigger>
            {/* Dropped below the trigger rather than overlaying it: the trigger carries a
                leading icon, so an item can never line up under its own label. The inset
                and the item padding are the trigger's, minus the popup's own p-1. */}
            <SelectContent alignItemWithTrigger={false} className="p-1">
              {devices.map((device) => (
                <SelectItem
                  key={device.deviceId}
                  value={device.deviceId}
                  className="py-2 pr-9 pl-3 lg:pl-3.5"
                >
                  {device.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Under the picker, not replacing it: the interpreter was moved to another mic. */}
          {notice && <p className="mt-2 text-meta font-normal text-muted-foreground">{notice}</p>}

          <SettingRow
            title="Noise suppression"
            description="Filters room hum and rustle."
            checked={preferences.noiseSuppression}
            onCheckedChange={(on) => onPreferencesChange({ noiseSuppression: on })}
          />
          <SettingRow
            title="Echo cancellation"
            description="Removes sound the room plays back. Leave it off on headphones."
            checked={preferences.echoCancellation}
            onCheckedChange={(on) => onPreferencesChange({ echoCancellation: on })}
          />
          <SettingRow
            title="Auto gain control"
            description={
              <>
                Off lets you set the gain by hand
                {/* Only true where the slider is elsewhere; otherwise it sits directly below. */}
                {!inSettings && <span className="lg:hidden">, in Audio settings</span>}.
              </>
            }
            checked={preferences.autoGain}
            onCheckedChange={(on) => onPreferencesChange({ autoGain: on })}
          />

          {/* Desktop-only here: a phone reaches the slider through the audio-settings surface. */}
          {!inSettings && (
            <GainSlider
              gain={preferences.gain}
              onGainChange={(gain) => onPreferencesChange({ gain })}
              disabled={preferences.autoGain}
              className="mt-3.5 hidden border-t border-border pt-3.5 lg:block"
            />
          )}
        </>
      )}
    </section>
  );
}

function SettingRow({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string;
  description: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className={ROW}>
      <div className="flex-1">
        <div className="font-semibold text-sm">{title}</div>
        <p className="mt-0.5 text-meta font-normal text-muted-foreground">{description}</p>
      </div>
      <Switch size="lg" checked={checked} aria-label={title} onCheckedChange={onCheckedChange} />
    </div>
  );
}

/**
 * A reload is the only real retry for a denied prompt, and it is free on pre-flight. Inside
 * the settings surface it is not: that is open mid-broadcast, where a reload would drop the
 * socket, the presence claim and the live state, so there the capture re-opens in place.
 */
function MicUnavailable({
  message,
  inSettings,
  onRetry,
}: {
  message: string;
  inSettings: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="mt-2.25 lg:mt-2.5">
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button
        variant="outline"
        onClick={inSettings ? onRetry : () => window.location.reload()}
        className="mt-3.5 h-11 rounded-full px-5 font-semibold text-sm"
      >
        Try again
      </Button>
    </div>
  );
}
