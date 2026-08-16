import { LiveDot } from '@/components/live-dot';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * The pill every screen states its liveness in: the dot, the treatment, and one line of
 * copy. `label` is a prop rather than derived here because each screen's ladder is its
 * own — two states on the selector and the studio, four in the listener room — and only
 * the call site knows which of them is being shown.
 */
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
