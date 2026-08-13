import type { components } from '@linguacast/contract/openapi';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type AdminChannel = components['schemas']['AdminChannel'];

const CHIP = 'h-6 rounded-full px-2.5 text-[11.5px] font-semibold';

/** How many channels a `collapse` row shows before the rest become a `+N`. */
const COLLAPSE_LIMIT = 3;

/**
 * The channel list as chips. `collapse` keeps a table row one line tall by showing three
 * channels and a count; `wrap` lets a card grow instead. Enabled channels are ordered
 * first either way, so the ones an admin cares about are never the ones collapsed away.
 */
export function ChannelChips({
  channels,
  variant,
  className,
}: {
  channels: AdminChannel[];
  variant: 'collapse' | 'wrap';
  className?: string;
}) {
  if (channels.length === 0) {
    return (
      <div className={cn('flex items-center', className)}>
        <Badge
          variant="outline"
          className={cn(CHIP, 'border-dashed bg-transparent text-muted-foreground')}
        >
          No channels yet
        </Badge>
      </div>
    );
  }

  const ordered = [...channels].sort((a, b) => Number(b.enabled) - Number(a.enabled));
  const shown = variant === 'collapse' ? ordered.slice(0, COLLAPSE_LIMIT) : ordered;
  const overflow = ordered.length - shown.length;

  return (
    <div
      className={cn(
        'flex items-center gap-1.5',
        variant === 'collapse' ? 'flex-nowrap overflow-hidden' : 'flex-wrap',
        className,
      )}
    >
      {shown.map((channel) => (
        // The design fills an active chip with the live tint; enabled is not on air, so the
        // fill is a wash of `foreground` instead — the same colour the enable switch uses to
        // mean on. It has to read against `secondary`, which is the phone card's own fill.
        <Badge
          key={channel.id}
          variant={channel.enabled ? 'secondary' : 'outline'}
          className={cn(
            CHIP,
            channel.enabled
              ? 'bg-foreground/10 text-foreground dark:bg-foreground/15'
              : 'text-muted-foreground',
          )}
        >
          {channel.name}
        </Badge>
      ))}
      {overflow > 0 && (
        // Not a link: channels are managed on the detail page, and the row's job is only
        // to say what exists.
        <Badge variant="secondary" className={cn(CHIP, 'text-muted-foreground')}>
          +{overflow}
          <span className="sr-only"> more channels</span>
        </Badge>
      )}
    </div>
  );
}
