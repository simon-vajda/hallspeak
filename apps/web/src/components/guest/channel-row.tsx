import type { components } from '@linguacast/contract/openapi';
import { Link } from '@tanstack/react-router';
import { Play } from 'lucide-react';
import { LiveDot } from '@/components/live-dot';
import { cn } from '@/lib/utils';

type PublicChannel = components['schemas']['PublicChannel'];

// One-offs of this screen: the ramp's section step would flatten the row against its own
// metadata line.
const ROW = 'flex items-center gap-3.5 rounded-lg px-5 py-4.25 lg:gap-4 lg:px-6 lg:py-5';
const NAME = 'text-[19px] font-semibold tracking-[-0.025em] lg:text-[22px] lg:tracking-[-0.03em]';

/**
 * An offline channel is a plain `div`: there is nothing behind it until its interpreter
 * connects. The play affordance is decorative, since the row itself is the link.
 */
export function ChannelRow({
  channel,
  pin,
  online,
}: {
  channel: PublicChannel;
  pin: string;
  online: boolean;
}) {
  if (!online) {
    return (
      <div className={cn(ROW, 'border border-dashed border-border')}>
        <LiveDot tone="offline" />
        <div className="flex-1">
          <div className={cn(NAME, 'text-muted-foreground')}>{channel.name}</div>
          <div className="mt-px text-note text-muted-foreground lg:mt-0.5">
            Waiting for the interpreter
          </div>
        </div>
      </div>
    );
  }

  return (
    <Link
      to="/events/$pin/$slug"
      params={{ pin, slug: channel.slug }}
      className={cn(
        ROW,
        // The design draws no hover; a wash of the row's own fill reads in both themes without
        // borrowing another role's colour.
        'bg-card transition-colors hover:bg-card/70',
        'focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
      )}
    >
      <LiveDot />
      <div className="flex-1">
        <div className={NAME}>{channel.name}</div>
        <div className="mt-px text-note text-muted-foreground lg:mt-0.5">On air</div>
      </div>
      <span
        aria-hidden
        className="flex size-9 items-center justify-center gap-2.25 rounded-full bg-primary text-primary-foreground lg:h-11 lg:w-auto lg:px-6 lg:text-[15px] lg:font-semibold"
      >
        <Play className="size-3.5 fill-current lg:size-3.75" />
        <span className="hidden lg:inline">Listen</span>
      </span>
    </Link>
  );
}
