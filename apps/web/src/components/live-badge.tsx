import { LiveDot } from '@/components/live-dot';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * `label` is a prop, not derived: each screen's state ladder is its own. `showDot={false}` is
 * the same chip carrying a name rather than a state — the dot means an interpreter is
 * connected to the channel, so a chip that is not reporting liveness must not show one.
 */
export function LiveBadge({
  live,
  label,
  showDot = true,
  className,
}: {
  live: boolean;
  label: string;
  showDot?: boolean;
  className?: string;
}) {
  return (
    <Badge
      className={cn(
        'uppercase',
        live ? 'bg-live-muted text-live-on-muted' : 'bg-secondary text-muted-foreground',
        className,
      )}
    >
      {showDot && <LiveDot size="sm" tone={live ? 'live' : 'offline'} />}
      {label}
    </Badge>
  );
}
