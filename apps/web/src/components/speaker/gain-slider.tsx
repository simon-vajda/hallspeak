import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

/**
 * The manual gain control and its readout. It appears in two places — beside the
 * preferences on the desktop pre-flight card, and in the audio-settings surface a phone
 * reaches mid-broadcast — so the wrapper that decides *where* it shows belongs to the
 * caller and only the control itself lives here.
 *
 * Like the two switches above it, this applies to nothing yet: it becomes a `GainNode` in
 * the capture graph when that graph feeds a producer.
 */
export function GainSlider({
  gain,
  onGainChange,
  disabled,
  className,
}: {
  /** 0–100, as the design's readout displays it. */
  gain: number;
  onGainChange: (gain: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <span className="text-label text-muted-foreground uppercase">Gain</span>
        <span className="text-note font-semibold">{gain}%</span>
      </div>
      <Slider
        aria-label="Microphone gain"
        value={gain}
        // Base UI types every slider's value as number | number[]; this one has a single
        // thumb, so the array branch is unreachable.
        onValueChange={(value) => onGainChange(typeof value === 'number' ? value : gain)}
        disabled={disabled}
        className={cn(
          '[&_[data-slot=slider-thumb]]:size-5.5 [&_[data-slot=slider-thumb]]:border-2',
          '[&_[data-slot=slider-thumb]]:border-primary [&_[data-slot=slider-thumb]]:bg-background',
          '[&_[data-slot=slider-track]]:h-1.5 [&_[data-slot=slider-track]]:bg-border',
        )}
      />
    </div>
  );
}
