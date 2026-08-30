import { Loader2, OctagonX } from 'lucide-react';
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
  const label = linkLabel(link);

  return (
    // The four shapes are 17px to 47px tall, so the slot is reserved rather than measured:
    // otherwise everything below the line jumps by 30px the moment audio starts flowing.
    <div className={cn('flex min-h-12 flex-col items-center justify-center gap-2', className)}>
      {link.kind === 'idle' ? null : link.kind === 'flowing' ? (
        <>
          <Bars filled={filledBars(link)} />
          <p aria-live="polite" className="text-meta text-muted-foreground">
            {label}
          </p>
        </>
      ) : link.kind === 'connecting' || link.kind === 'reconnecting' ? (
        <p
          aria-live="polite"
          className="flex items-center gap-2.25 rounded-full bg-primary/12 px-4.75 py-3 text-sm font-semibold"
        >
          <Loader2
            aria-hidden
            className="size-4 animate-spin text-primary motion-reduce:animate-none"
          />
          {label}
        </p>
      ) : link.kind === 'lost' ? (
        <p
          aria-live="polite"
          className="flex items-center gap-2.25 rounded-full border border-destructive-border bg-destructive-muted px-4.75 py-3 text-sm font-semibold text-destructive"
        >
          <OctagonX aria-hidden className="size-4" />
          {label}
        </p>
      ) : (
        <p aria-live="polite" className="text-meta text-muted-foreground">
          {label}
        </p>
      )}
    </div>
  );
}

function Bars({ filled }: { filled: number }) {
  return (
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
