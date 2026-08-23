import { LiveBadge } from '@/components/live-badge';
import { Pin } from '@/components/pin';

/**
 * `live` is whether the guest's own socket is connected, not that anyone is speaking. Who is
 * speaking is a per-channel fact and belongs to the rows.
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
        <p className="mb-2 text-sm leading-normal text-muted-foreground lg:mb-6 lg:text-body-lg">
          {description}
        </p>
      )}

      <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-meta text-muted-foreground lg:gap-2.5 lg:px-4.5 lg:py-2.5 lg:text-note lg:font-medium">
        PIN
        <Pin pin={pin} className="text-note font-semibold text-foreground lg:text-pin" />
      </div>
    </div>
  );
}
