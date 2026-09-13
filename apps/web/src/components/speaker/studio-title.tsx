import { LiveBadge } from '@/components/live-badge';
import { cn } from '@/lib/utils';
import type { StudioBadge } from './speaker-studio-state';

export function StudioTitle({
  eventName,
  name,
  badge,
  className,
}: {
  eventName: string;
  name: string;
  badge: StudioBadge;
  className?: string;
}) {
  return (
    <div className={cn('flex w-full min-w-0 flex-col items-center text-center', className)}>
      <LiveBadge live={badge.live} showDot={badge.showDot} label={badge.label} />
      <p className="mt-4 max-w-full wrap-break-word text-body-lg text-muted-foreground lg:mt-3.5 lg:text-xl">
        {eventName}
      </p>
      <h1 className="mt-1 max-w-full wrap-break-word text-screen lg:mt-1.5 lg:text-hero">{name}</h1>
    </div>
  );
}
