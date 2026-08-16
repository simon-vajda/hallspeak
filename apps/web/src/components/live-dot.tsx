import { cn } from '@/lib/utils';

const SIZES = {
  sm: 'size-1.75', // 7px — inside a badge or pill
  md: 'size-2.5', // 10px — standalone, in a channel row
} as const;

/**
 * The pulsing signal dot. `offline` is a tone rather than the absence of the element:
 * the dot's *position* is what carries the state, so an offline row still renders one in
 * `border` — dropping it would shift everything beside it as channels go on and off air.
 *
 * The pulse holds solid under `prefers-reduced-motion` (see `index.css`) because it is a
 * status, not decoration.
 */
export function LiveDot({
  size = 'md',
  tone = 'live',
  className,
}: {
  size?: keyof typeof SIZES;
  tone?: 'live' | 'offline';
  className?: string;
}) {
  const live = tone === 'live';
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block shrink-0 rounded-full',
        SIZES[size],
        live ? 'animate-pulse-live bg-live' : 'bg-border',
        className,
      )}
    />
  );
}
