import { useRef } from 'react';
import type { ConnectionState } from '@/lib/media/stats';
import { BAR_COUNT, connectionLabel, filledBars } from '@/lib/media/stats';
import type { SocketStatus } from '@/lib/use-socket';
import { cn } from '@/lib/utils';

/**
 * The design's nine-bar waveform, now that there is real data behind it. The text stays
 * alongside it rather than being replaced by it: the bars carry no meaning to a screen
 * reader, and this line is precisely where the states worth announcing show up.
 *
 * `error` is already resolved to human copy by the route. `lost` covers the gap before
 * Socket.IO starts its retry; "Reconnecting" is only true once that attempt begins.
 */
export function ConnectionLine({
  status,
  error,
  connection,
  className,
}: {
  status: SocketStatus;
  error?: string | null;
  /** Omitted where no media exists yet; the socket state is then the whole story. */
  connection?: ConnectionState;
  className?: string;
}) {
  const hasConnected = useRef(false);
  if (status === 'connected') {
    hasConnected.current = true;
  }

  const text =
    status === 'lost'
      ? 'Connection lost'
      : status === 'error'
        ? (error ?? 'Connection failed.')
        : status !== 'connected'
          ? hasConnected.current
            ? 'Reconnecting…'
            : 'Connecting…'
          : connection
            ? connectionLabel(connection)
            : 'Connected';

  const filled = connection && status === 'connected' ? filledBars(connection) : 0;

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      {connection && (
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
      )}
      {/* Assertive would interrupt; this line changes on its own. */}
      <p aria-live="polite" className="text-meta text-muted-foreground">
        {text}
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
