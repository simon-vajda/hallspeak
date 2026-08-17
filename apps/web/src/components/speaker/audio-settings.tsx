import { ChevronDown, Mic } from 'lucide-react';
import { useEffect, useState } from 'react';
import { GainSlider } from '@/components/speaker/gain-slider';
import { MicPanel } from '@/components/speaker/mic-panel';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import type { useMicCapture } from '@/lib/audio/use-mic-capture';
import { cn } from '@/lib/utils';

type MicHandle = ReturnType<typeof useMicCapture>;

/** The `lg` breakpoint, as a media query rather than a class; see `useIsDesktop`. */
const DESKTOP = '(min-width: 64rem)';

type Props = {
  mic: MicHandle;
  noiseSuppression: boolean;
  onNoiseSuppressionChange: (on: boolean) => void;
  autoGain: boolean;
  onAutoGainChange: (on: boolean) => void;
  gain: number;
  onGainChange: (gain: number) => void;
  className?: string;
};

/**
 * The sheet and the popover are chosen, not rendered together behind `lg:hidden`: two mounted
 * dialogs means two focus traps and two elements claiming the same title. Hence the
 * `matchMedia` read — the only place in this app where a breakpoint exists in JavaScript.
 */
export function AudioSettings({ className, ...props }: Props) {
  const desktop = useIsDesktop();
  const label = props.mic.devices.find((d) => d.deviceId === props.mic.deviceId)?.label;

  const row = (
    <>
      <span className="flex min-w-0 items-center gap-2.5">
        <Mic className="size-4.5 shrink-0 stroke-[2.25]" />
        <span className="min-w-0">
          <span className="block truncate font-semibold text-sm">{label ?? 'Microphone'}</span>
          <span className="block text-meta font-normal text-muted-foreground">Audio settings</span>
        </span>
      </span>
      <ChevronDown className="size-4.5 shrink-0 stroke-[2.25] text-muted-foreground" />
    </>
  );

  const trigger = cn(
    'flex w-full cursor-pointer items-center justify-between gap-3 rounded-full bg-secondary px-5 py-3.25 text-left focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
    className,
  );

  if (desktop) {
    return (
      <Popover>
        <PopoverTrigger className={trigger}>{row}</PopoverTrigger>
        {/* Anchored to the row's trailing edge so it opens inside the content column. */}
        <PopoverContent align="end" sideOffset={8} className="w-85 gap-0 p-5">
          {/* No `Done`, unlike the sheet: a popover closes on the next click anywhere. */}
          <PopoverTitle className="mb-3.5 text-section">Audio</PopoverTitle>
          <SettingsBody {...props} />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Sheet>
      <SheetTrigger className={trigger}>{row}</SheetTrigger>
      {/* 28px is this one surface's own radius, between the card radius and a full round. */}
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[85dvh] gap-0 overflow-y-auto rounded-t-[28px] px-5.5 pt-3.5 pb-6.5"
      >
        <span aria-hidden className="mx-auto mb-4.5 h-1 w-9.5 rounded-full bg-border" />
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <SheetTitle className="text-section">Audio</SheetTitle>
          {/* `primary` because Done is an action; the canvas uses `live`, a state colour. */}
          <SheetClose className="cursor-pointer text-note font-semibold text-primary">
            Done
          </SheetClose>
        </div>
        <SettingsBody {...props} />
      </SheetContent>
    </Sheet>
  );
}

/**
 * The same body under both surfaces. `inSettings` hides the card's own slider, which is
 * desktop-only there, so the one below is the only copy rather than a second one.
 */
function SettingsBody({
  mic,
  noiseSuppression,
  onNoiseSuppressionChange,
  autoGain,
  onAutoGainChange,
  gain,
  onGainChange,
}: Omit<Props, 'className'>) {
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
        noiseSuppression={noiseSuppression}
        onNoiseSuppressionChange={onNoiseSuppressionChange}
        autoGain={autoGain}
        onAutoGainChange={onAutoGainChange}
        gain={gain}
        onGainChange={onGainChange}
        inSettings
        className="lg:p-5"
      />

      <GainSlider gain={gain} onGainChange={onGainChange} disabled={autoGain} className="mt-3.5" />

      <p className="mt-3.5 text-note text-muted-foreground">
        You stay on air while this is open. Switching device drops about a second of audio, so do it
        between sentences.
      </p>
    </>
  );
}

/**
 * Initialised from the same read it subscribes to, so the first paint picks the right surface
 * rather than mounting a sheet and swapping it.
 */
function useIsDesktop() {
  const [desktop, setDesktop] = useState(() => window.matchMedia(DESKTOP).matches);

  useEffect(() => {
    const query = window.matchMedia(DESKTOP);
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return desktop;
}
