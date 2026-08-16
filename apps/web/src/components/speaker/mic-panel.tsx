import { Mic } from 'lucide-react';
import type { ReactNode } from 'react';
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
import type { MicDevice } from '@/lib/audio/devices';
import type { MicStatus } from '@/lib/audio/use-mic-capture';
import { cn } from '@/lib/utils';

/**
 * These are settings, not liveness, so a checked track is `foreground` — the same rule the
 * admin's enable switches follow. `primary` marks what you can press and `live` marks that
 * audio is moving; neither may stand in for "this preference is on".
 */
const SETTING_TRACK = 'data-checked:bg-foreground';

/** Every row below the device picker is separated by a hairline, at one indent. */
const ROW = 'mt-3.5 flex items-center gap-3.5 border-t border-border pt-3.5';

/**
 * The pre-flight microphone card (`10f`, `10s`): the device picker plus the audio-processing
 * preferences.
 *
 * **The preferences are held and applied to nothing.** Noise suppression and auto gain
 * become `MediaTrackConstraints` on the capture track (`applyConstraints`) at the moment
 * that track feeds a mediasoup producer, and the manual gain becomes a `GainNode` spliced
 * into the same graph in that change. Wiring them today would mean re-opening the stream to
 * change a setting that nobody can hear.
 */
export function MicPanel({
  status,
  error,
  devices,
  deviceId,
  onSelectDevice,
  noiseSuppression,
  onNoiseSuppressionChange,
  autoGain,
  onAutoGainChange,
  gain,
  onGainChange,
  inSettings = false,
  className,
}: {
  status: MicStatus;
  error: string | null;
  devices: MicDevice[];
  deviceId: string | null;
  onSelectDevice: (deviceId: string) => void;
  noiseSuppression: boolean;
  onNoiseSuppressionChange: (on: boolean) => void;
  autoGain: boolean;
  onAutoGainChange: (on: boolean) => void;
  /** 0–100, as the design's readout displays it. */
  gain: number;
  onGainChange: (gain: number) => void;
  /** Rendered inside the audio-settings surface, which supplies the gain slider itself. */
  inSettings?: boolean;
  className?: string;
}) {
  // Every terminal case renders copy instead of the picker: an empty `Select` under a
  // heading that says "Microphone" tells the interpreter nothing about why it is empty.
  const blocked = status === 'denied' || status === 'unsupported';
  const empty = status === 'ready' && devices.length === 0;

  return (
    <section className={cn('rounded-lg bg-secondary px-5 py-4.5 lg:p-5.5', className)}>
      <h2 className="text-label text-muted-foreground uppercase">Microphone</h2>

      {blocked || empty ? (
        <MicUnavailable
          message={error ?? 'No microphone was found. Connect one, then try again.'}
        />
      ) : (
        <>
          <Select
            items={devices.map((device) => ({ label: device.label, value: device.deviceId }))}
            value={deviceId}
            onValueChange={(value) => {
              if (value) onSelectDevice(value);
            }}
            disabled={devices.length === 0}
          >
            {/* The trigger's own height is a `data-[size]` variant, so a plain `h-11` loses
                to it on specificity — the pill row has to be written at the same weight. */}
            <SelectTrigger className="mt-2.25 w-full gap-2.5 rounded-full border-border bg-background px-4 font-semibold text-sm data-[size=default]:h-11 lg:mt-2.5 lg:px-4.5 lg:data-[size=default]:h-11.5">
              <Mic className="size-4.25 stroke-[2.25]" />
              <SelectValue placeholder="Opening the microphone…" />
            </SelectTrigger>
            <SelectContent>
              {devices.map((device) => (
                <SelectItem key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <SettingRow
            title="Noise suppression"
            description="Filters room hum and rustle."
            checked={noiseSuppression}
            onCheckedChange={onNoiseSuppressionChange}
          />
          <SettingRow
            title="Auto gain control"
            description={
              <>
                Off lets you set the gain by hand
                {/* The pointer is only true where the slider is somewhere else. Inside the
                    settings surface it sits directly below, and on a desktop pre-flight
                    card it is the next control down. */}
                {!inSettings && <span className="lg:hidden">, in Audio settings</span>}.
              </>
            }
            checked={autoGain}
            onCheckedChange={onAutoGainChange}
          />

          {/* On the pre-flight card the slider is desktop-only, exactly as drawn — a phone
              reaches it through the audio-settings surface, which renders it at every
              width and therefore renders this panel without one. */}
          {!inSettings && (
            <GainSlider
              gain={gain}
              onGainChange={onGainChange}
              disabled={autoGain}
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
      <Switch
        size="lg"
        checked={checked}
        aria-label={title}
        onCheckedChange={onCheckedChange}
        className={SETTING_TRACK}
      />
    </div>
  );
}

/**
 * Permission refused, an insecure origin, or simply no input device. A reload is the only
 * real retry for the first two — a browser that has denied the prompt will not show it
 * again from script — and it costs nothing on this page, which holds no unsaved state.
 */
function MicUnavailable({ message }: { message: string }) {
  return (
    <div className="mt-2.25 lg:mt-2.5">
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button
        variant="outline"
        onClick={() => window.location.reload()}
        className="mt-3.5 h-11 rounded-full px-5 font-semibold text-sm"
      >
        Try again
      </Button>
    </div>
  );
}
