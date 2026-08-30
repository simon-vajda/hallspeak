import { filledBars, type LinkState, linkLabel } from '@/lib/media/link-state';
import { BAR_COUNT } from '@/lib/media/stats';
import { cn } from '@/lib/utils';

/**
 * The design's nine-bar waveform, now that there is real data behind it. The text stays
 * alongside it rather than being replaced by it: the bars carry no meaning to a screen
 * reader, and this line is precisely where the states worth announcing show up.
 *
 * Socket and media health are already resolved before this component sees them, so one
 * fixed vocabulary owns the line.
 */
export function ConnectionLine({ link, className }: { link: LinkState; className?: string }) {
  const filled = filledBars(link);

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div aria-hidden className="flex items-end gap-1">
        {BARS.map((height, index) => (
          <span
            // Heights repeat by design (the shape is symmetric), so the index is the key.
            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed-length static bar row.
            key={index}
            className={cn(
              'w-1 rounded-full transition-colors duration-300',
              index < filled ? 'bg-primary' : 'bg-border',
            )}
            style={{ height }}
          />
        ))}
      </div>
      {/* Assertive would interrupt; this line changes on its own. */}
      <p aria-live="polite" className="text-meta text-muted-foreground">
        {linkLabel(link)}
      </p>
    </div>
  );
}

/**
 * The design's waveform silhouette — tallest in the middle, tapering to both ends —
 * derived from `BAR_COUNT` rather than written out, so the two cannot drift apart.
 */
const BARS = Array.from({ length: BAR_COUNT }, (_, index) => {
  const distanceFromCentre = Math.abs(index - (BAR_COUNT - 1) / 2);
  return `${22 - distanceFromCentre * 4}px`;
});
