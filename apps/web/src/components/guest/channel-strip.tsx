import type { components } from '@linguacast/contract/openapi';
import { Link } from '@tanstack/react-router';
import { LiveDot } from '@/components/live-dot';
import { cn } from '@/lib/utils';

type PublicChannel = components['schemas']['PublicChannel'];

const PILL = 'flex items-center gap-2.25 rounded-full px-4.5 py-2.5 text-sm font-semibold';

/**
 * Desktop-only: below `lg` the listener room's own back link is the way out of a channel.
 */
export function ChannelStrip({
  channels,
  currentSlug,
  pin,
  className,
}: {
  channels: PublicChannel[];
  currentSlug: string;
  pin: string;
  className?: string;
}) {
  if (channels.length < 2) {
    return null;
  }

  return (
    <nav aria-label="Channels" className={cn('hidden border-b border-border lg:block', className)}>
      <div className="mx-auto flex w-full max-w-shell items-center justify-center gap-2.5 px-10 py-5.5">
        {channels.map((channel) => {
          if (channel.slug === currentSlug) {
            return (
              <span
                key={channel.slug}
                aria-current="page"
                className={cn(PILL, 'bg-primary text-primary-foreground')}
              >
                {/* Not a LiveDot: `live` is a state colour and must not be repainted to sit
                    on `primary`. */}
                <span
                  aria-hidden
                  className={cn(
                    'size-2 rounded-full',
                    channel.online ? 'animate-pulse-live bg-current' : 'bg-border',
                  )}
                />
                {channel.name}
                <span className="sr-only">, {channel.online ? 'On air' : 'Offline'}</span>
              </span>
            );
          }

          if (!channel.online) {
            return (
              <Link
                key={channel.slug}
                to="/events/$pin/$slug"
                params={{ pin, slug: channel.slug }}
                aria-label={`${channel.name}, Offline`}
                className={cn(
                  PILL,
                  'border border-dashed border-border text-muted-foreground',
                  'focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
                )}
              >
                <LiveDot size="sm" tone="offline" />
                {channel.name}
              </Link>
            );
          }

          return (
            <Link
              key={channel.slug}
              to="/events/$pin/$slug"
              params={{ pin, slug: channel.slug }}
              aria-label={`${channel.name}, On air`}
              className={cn(
                PILL,
                'bg-card transition-colors hover:overlay',
                'focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
              )}
            >
              <LiveDot size="sm" />
              {channel.name}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
