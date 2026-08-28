import { Check, Headphones, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { AudioSurface } from '@/components/audio-surface';
import { Button } from '@/components/ui/button';
import type { useAudioOutput } from '@/lib/audio/use-audio-output';
import { cn } from '@/lib/utils';

type OutputHandle = ReturnType<typeof useAudioOutput>;

export function OutputPicker({ output, className }: { output: OutputHandle; className?: string }) {
  const [open, setOpen] = useState(false);

  if (output.status === 'unsupported') {
    return null;
  }

  return (
    <AudioSurface
      icon={<Headphones className="size-4.5 shrink-0 stroke-[2.25]" />}
      label={
        output.status === 'ready'
          ? (output.currentDevice?.label ?? 'Audio output')
          : 'Choose where audio plays'
      }
      secondaryLabel="Audio output"
      title="Audio output"
      className={className}
      open={open}
      onOpenChange={setOpen}
    >
      <OutputBody output={output} onSelected={() => setOpen(false)} />
    </AudioSurface>
  );
}

function OutputBody({ output, onSelected }: { output: OutputHandle; onSelected: () => void }) {
  if (output.status !== 'ready') {
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

  const selectedId = output.currentDevice?.deviceId ?? null;
  const only = output.devices.length === 1 ? output.devices[0] : null;

  return (
    <>
      {only ? (
        <div className="rounded-sm bg-accent px-3.5 py-3">
          <div className="truncate font-semibold text-sm">{only.label}</div>
          <p className="mt-0.75 text-note text-muted-foreground">
            The only output this browser can see. Connect headphones and they appear here.
          </p>
        </div>
      ) : (
        <fieldset className="flex flex-col gap-0.5" aria-label="Output device">
          {output.devices.map((device) => {
            const selected = device.deviceId === selectedId;
            return (
              <button
                key={device.deviceId}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  output.select(device.deviceId);
                  onSelected();
                }}
                className={cn(
                  'flex min-h-touch w-full cursor-pointer items-center justify-between gap-3 rounded-sm px-3.5 py-2.5 text-left text-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
                  selected ? 'bg-accent font-semibold' : 'hover:overlay-strong',
                )}
              >
                <span className="truncate">{device.label}</span>
                {selected && <Check className="size-4 shrink-0 stroke-[2.5]" />}
              </button>
            );
          })}
        </fieldset>
      )}

      <p className="mt-3.5 text-note text-muted-foreground">
        Switching output drops about a second of audio. This device is remembered for next time.
      </p>
    </>
  );
}
