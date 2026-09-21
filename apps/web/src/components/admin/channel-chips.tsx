import type { components } from '@hallspeak/contract/openapi';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type AdminChannel = components['schemas']['AdminChannel'];

/** How many channels a `collapse` row shows before the rest become a `+N`. */
const COLLAPSE_LIMIT = 3;

/**
 * The design fills an active chip with the live tint; enabled is not on air, so the fill is a
 * wash of `foreground`, the same colour the enable switch uses. It reads against `secondary`.
 */
export function ChannelChip({
  enabled,
  className,
  children,
}: {
  enabled: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Badge
      size="sm"
      variant={enabled ? 'secondary' : 'outline'}
      className={cn(
        enabled
          ? 'bg-foreground/10 text-foreground dark:bg-foreground/15'
          : 'text-muted-foreground',
        className,
      )}
    >
      {children}
    </Badge>
  );
}

/**
 * `collapse` keeps a table row one line tall by showing a count; `wrap` lets a card grow.
 * Enabled channels sort first either way, so they are never the ones collapsed away.
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
          size="sm"
          variant="outline"
          className="border-dashed bg-transparent text-muted-foreground"
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
        <ChannelChip key={channel.id} enabled={channel.enabled}>
          {channel.name}
        </ChannelChip>
      ))}
      {overflow > 0 && (
        // Not a link: channels are managed on the detail page.
        <Badge size="sm" variant="secondary" className="text-muted-foreground">
          +{overflow}
          <span className="sr-only"> more channels</span>
        </Badge>
      )}
    </div>
  );
}
