import { LiveDot } from '@/components/live-dot';
import { Badge } from '@/components/ui/badge';
import { formatPin } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * The event's identity block: the live badge, the title, the description and the PIN. It
 * is the natural seam between the two desktop columns — the whole of the left one.
 *
 * `live` is whether the guest's own socket is connected, which is the only liveness this
 * screen can honestly claim: it says "this page is receiving updates", not that anyone is
 * speaking. That is a per-channel fact and belongs to the rows.
 */
export function EventHeader({
  name,
  description,
  pin,
  live,
  className,
}: {
  name: string;
  description: string | null;
  pin: string;
  live: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <Badge
        className={cn(
          'h-auto gap-1.75 rounded-full px-3.25 py-1.5 text-label uppercase',
          live ? 'bg-live-muted text-live-foreground' : 'bg-secondary text-muted-foreground',
        )}
      >
        <LiveDot size="sm" tone={live ? 'live' : 'offline'} />
        {live ? 'Event live' : 'Connecting'}
      </Badge>

      <h1 className="mt-4 mb-2.5 text-screen lg:mt-5 lg:mb-3.5 lg:text-[52px] lg:leading-[1.03] lg:tracking-[-0.045em]">
        {name}
      </h1>

      {description && (
        <p className="mb-2 text-sm leading-normal text-muted-foreground lg:mb-6 lg:text-[17px] lg:leading-[1.6]">
          {description}
        </p>
      )}

      <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-meta text-muted-foreground lg:gap-2.5 lg:px-4.5 lg:py-2.5 lg:text-note lg:font-medium">
        PIN
        {/* The one place the PIN is printed back to the guest, so it is set larger than the
            label beside it and tracked out to stay readable as digits. */}
        <span className="text-note font-semibold tracking-[0.04em] text-foreground lg:text-[20px]">
          {formatPin(pin)}
        </span>
      </div>
    </div>
  );
}
