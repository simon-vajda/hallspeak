import { LiveDot } from '@/components/live-dot';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/** `label` is a prop, not derived: each screen's state ladder is its own. */
export function LiveBadge({
  live,
  label,
  className,
}: {
  live: boolean;
  label: string;
  className?: string;
}) {
  return (
    <Badge
      className={cn(
        'h-auto gap-1.75 rounded-full px-3.25 py-1.5 text-label uppercase',
        live ? 'bg-live-muted text-live-foreground' : 'bg-secondary text-muted-foreground',
        className,
      )}
    >
      <LiveDot size="sm" tone={live ? 'live' : 'offline'} />
      {label}
    </Badge>
  );
}
