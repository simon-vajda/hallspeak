import { ChevronDown, Mic } from 'lucide-react';
import { useEffect, useState } from 'react';
import { GainSlider } from '@/components/speaker/gain-slider';
import type { AudioPreferences } from '@/components/speaker/live-state';
import { MicPanel } from '@/components/speaker/mic-panel';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import type { useMicCapture } from '@/lib/audio/use-mic-capture';
import { cn } from '@/lib/utils';

type MicHandle = ReturnType<typeof useMicCapture>;

/** The `lg` breakpoint, as a media query rather than a class; see `useIsDesktop`. */
const DESKTOP = '(min-width: 64rem)';

type Props = {
  mic: MicHandle;
  preferences: AudioPreferences;
  onPreferencesChange: (patch: Partial<AudioPreferences>) => void;
  className?: string;
};

/**
 * The sheet and the dialog are chosen, not rendered together behind `lg:hidden`: two mounted
 * dialogs means two focus traps and two elements claiming the same title. Hence the
 * `matchMedia` read, the only place in this app where a breakpoint exists in JavaScript.
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
      <Dialog>
        <DialogTrigger className={trigger}>{row}</DialogTrigger>
        {/* Centred rather than anchored, and held to the width the settings body was drawn at. */}
        <DialogContent
          showCloseButton={false}
          className="grid-cols-[minmax(0,1fr)] p-panel sm:max-w-100"
        >
          <div className="mb-3.5 flex items-baseline justify-between gap-3">
            <DialogTitle className="text-section">Audio</DialogTitle>
            {/* `Done` as on the sheet: a modal dialog needs a way out that is not the backdrop. */}
            <DialogClose className="cursor-pointer text-note font-semibold text-primary">
              Done
            </DialogClose>
          </div>
          <SettingsBody {...props} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet>
      <SheetTrigger className={trigger}>{row}</SheetTrigger>
      {/* 28px is this one surface's own radius, between the card radius and a full round. */}
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[85dvh] gap-0 overflow-y-auto rounded-t-xl px-panel pt-3.5 pb-6.5"
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
