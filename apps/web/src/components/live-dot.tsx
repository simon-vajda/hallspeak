import { cn } from '@/lib/utils';

const SIZES = {
  sm: 'size-1.75', // inside a badge or pill
  md: 'size-2.5', // standalone, in a channel row
} as const;

/**
 * `offline` is a tone rather than the absence of the element: dropping the dot would shift
 * everything beside it as channels go on and off air.
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
