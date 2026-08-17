import { LiveBadge } from '@/components/live-badge';
import { formatPin } from '@/lib/format';

/**
 * `live` is whether the guest's own socket is connected — "this page is receiving updates",
 * not that anyone is speaking. That is a per-channel fact and belongs to the rows.
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
      <LiveBadge live={live} label={live ? 'Event live' : 'Connecting'} />

      <h1 className="mt-4 mb-2.5 text-screen lg:mt-5 lg:mb-3.5 lg:text-screen-lg">{name}</h1>

      {description && (
        <p className="mb-2 text-sm leading-normal text-muted-foreground lg:mb-6 lg:text-[17px] lg:leading-[1.6]">
          {description}
        </p>
      )}

      <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-meta text-muted-foreground lg:gap-2.5 lg:px-4.5 lg:py-2.5 lg:text-note lg:font-medium">
        PIN
        {/* Tracked out to stay readable as digits. */}
        <span className="text-note font-semibold tracking-[0.04em] text-foreground lg:text-[20px]">
          {formatPin(pin)}
        </span>
      </div>
    </div>
  );
}
