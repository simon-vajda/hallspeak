import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

/**
 * Two callers place this differently, so the wrapper deciding where it shows is theirs. It
 * applies to nothing yet: it becomes a `GainNode` once the capture graph feeds a producer.
 */
export function GainSlider({
  gain,
  onGainChange,
  disabled,
  className,
}: {
  /** 0–100. */
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
        // An array, not the scalar: the wrapper derives its thumb count from Array.isArray and
        // falls back to [min, max], two stacked thumbs, for a number.
        value={[gain]}
        onValueChange={(value) =>
          onGainChange(typeof value === 'number' ? value : (value[0] ?? gain))
        }
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
