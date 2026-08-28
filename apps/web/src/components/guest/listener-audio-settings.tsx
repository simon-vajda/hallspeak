import { Check, Headphones, Loader2, Volume1, Volume2, VolumeX } from 'lucide-react';
import { AudioSurface } from '@/components/audio-surface';
import { MICRO_LABEL } from '@/components/micro-label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import type { useAudioOutput } from '@/lib/audio/use-audio-output';
import type { useAudioVolume } from '@/lib/audio/use-audio-volume';
import { cn } from '@/lib/utils';

type OutputHandle = ReturnType<typeof useAudioOutput>;
type VolumeHandle = ReturnType<typeof useAudioVolume>;

export function ListenerAudioSettings({
  output,
  volume,
  className,
}: {
  output: OutputHandle;
  volume: VolumeHandle;
  className?: string;
}) {
  // Naming the output on a browser that cannot route is the claim the design refuses to make:
  // the section is absent there, so the row carries the level and nothing else.
  const routable = output.status !== 'unsupported';
  const label = !routable
    ? 'Audio'
    : output.status === 'ready'
      ? (output.currentDevice?.label ?? 'Audio')
      : 'Choose where audio plays';
  const volumeLabel = volume.muted ? 'Muted' : `Volume ${volume.volume}%`;

  return (
    <AudioSurface
      icon={<Headphones className="size-4.5 shrink-0 stroke-[2.25]" />}
      label={label}
      secondaryLabel={routable ? `Audio output · ${volumeLabel}` : volumeLabel}
      title="Audio"
      className={className}
    >
      {routable && (
        <>
          <OutputSection output={output} />
          <Separator className="my-4.5" />
        </>
      )}
      <VolumeSection volume={volume} />
    </AudioSurface>
  );
}

function OutputSection({ output }: { output: OutputHandle }) {
  return (
    <div>
      <span className={cn('mb-2 block', MICRO_LABEL)}>Output</span>
      {output.status === 'ready' ? (
        <ReadyOutputs output={output} />
      ) : (
        <LockedOutputs output={output} />
      )}
    </div>
  );
}

function LockedOutputs({ output }: { output: OutputHandle }) {
  const denied = output.status === 'denied';
  return (
    <div>
      <p className="text-sm text-muted-foreground">
        {denied
          ? output.error
          : 'To list headphones and speakers, your browser needs microphone access. LinguaCast records nothing and releases access immediately.'}
      </p>
      <Button
        variant="outline"
        disabled={output.status === 'unlocking'}
        onClick={() => void output.unlock()}
        className="mt-3.5 h-11 rounded-full px-5 font-semibold text-sm"
      >
        {output.status === 'unlocking' && (
          <Loader2 className="animate-spin motion-reduce:animate-none" />
        )}
        {output.status === 'unlocking'
          ? 'Requesting access…'
          : denied
            ? 'Try again'
            : 'Show audio devices'}
      </Button>
    </div>
  );
}

function ReadyOutputs({ output }: { output: OutputHandle }) {
  const systemDefault = output.systemDefaultDevice;
  if (!systemDefault) {
    return null;
  }

  const explicitDevices = output.devices.filter(
    (device) => device.deviceId !== systemDefault.deviceId,
  );
  if (explicitDevices.length === 0) {
    return (
      <div className="rounded-sm bg-accent px-3.5 py-3">
        <div className="truncate font-semibold text-sm">{systemDefault.label}</div>
        <p className="mt-0.75 text-note text-muted-foreground">
          The only output this browser can see. Connect headphones and they appear here.
        </p>
      </div>
    );
  }

  return (
    <fieldset className="flex min-w-0 flex-col gap-0.5" aria-label="Output device">
      <OutputOption
        label={`System default — ${systemDefault.label}`}
        selected={output.deviceId === null}
        onSelect={output.clearSelection}
      />
      {explicitDevices.map((device) => (
        <OutputOption
          key={device.deviceId}
          label={device.label}
          selected={device.deviceId === output.deviceId}
          onSelect={() => output.select(device.deviceId)}
        />
      ))}
    </fieldset>
  );
}

function OutputOption({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'flex min-h-touch w-full cursor-pointer items-center justify-between gap-3 rounded-sm px-3.5 py-2.5 text-left text-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
        selected ? 'bg-accent font-semibold' : 'hover:overlay-strong',
      )}
    >
      <span className="truncate">{label}</span>
      {selected && <Check className="size-4 shrink-0 stroke-[2.5]" />}
    </button>
  );
}

function VolumeSection({ volume }: { volume: VolumeHandle }) {
  const Icon = volume.muted ? VolumeX : volume.volume < 50 ? Volume1 : Volume2;

  return (
    <div>
      <div className="mb-3.5 flex items-baseline justify-between gap-3">
        <span className={MICRO_LABEL}>Volume</span>
        <span className="font-mono text-meta font-semibold">
          {volume.muted ? 'Muted' : `${volume.volume}%`}
        </span>
      </div>
      <div className="flex items-center gap-3.5">
        <button
          type="button"
          aria-label={volume.muted ? 'Restore volume' : 'Mute'}
          onClick={volume.toggleMute}
          className="hover:overlay flex size-touch shrink-0 cursor-pointer items-center justify-center rounded-full bg-secondary focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
        >
          <Icon className="size-4.5 stroke-[2.25]" />
        </button>
        <Slider
          aria-label="Volume"
          value={[volume.volume]}
          onValueChange={(value) =>
            volume.setVolume(typeof value === 'number' ? value : (value[0] ?? volume.volume))
          }
          className="min-w-0 flex-1"
        />
      </div>
    </div>
  );
}
