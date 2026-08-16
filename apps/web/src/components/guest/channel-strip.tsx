import type { components } from '@linguacast/contract/openapi';
import { Link } from '@tanstack/react-router';
import { LiveDot } from '@/components/live-dot';
import { cn } from '@/lib/utils';

type PublicChannel = components['schemas']['PublicChannel'];

// 18px/10px padding and the 9px gap are this pill's own metrics; on the scale they are
// 4.5 / 2.5 / 2.25.
const PILL = 'flex items-center gap-2.25 rounded-full px-4.5 py-2.5 text-sm font-semibold';

/**
 * The desktop-only channel switcher under the header (`10r`). It replaces the phone's back
 * button as the way out of a channel, which is why it renders nothing below `lg` — there
 * the listener room has its own back link.
 *
 * An offline channel is inert and takes no focus, matching the selector's rows: there is
 * nothing behind it until its interpreter connects.
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
  if (channels.length < 2) return null;

  return (
    <nav
      aria-label="Channels"
      className={cn(
        'hidden items-center justify-center gap-2.5 border-b border-border px-10 py-5.5 lg:flex',
        className,
      )}
    >
      {channels.map((channel) => {
        if (channel.slug === currentSlug) {
          return (
            <span
              key={channel.slug}
              aria-current="page"
              className={cn(PILL, 'bg-primary text-primary-foreground')}
            >
              {/* Not a LiveDot: on the current pill the design draws the marker in the
                  pill's own foreground, and `live` is a state colour that must not be
                  repainted to sit on `primary`. */}
              {channel.online && (
                <span aria-hidden className="size-2 animate-pulse-live rounded-full bg-current" />
              )}
              {channel.name}
            </span>
          );
        }

        if (!channel.online) {
          return (
            <span
              key={channel.slug}
              className={cn(PILL, 'border border-dashed border-border text-muted-foreground')}
            >
              {channel.name}
            </span>
          );
        }

        return (
          <Link
            key={channel.slug}
            to="/events/$pin/$slug"
            params={{ pin, slug: channel.slug }}
            className={cn(
              PILL,
              'bg-card transition-colors hover:bg-card/70',
              'focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
            )}
          >
            <LiveDot size="sm" />
            {channel.name}
          </Link>
        );
      })}
    </nav>
  );
}
