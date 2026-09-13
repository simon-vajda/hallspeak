import { LiveBadge } from '@/components/live-badge';
import { cn } from '@/lib/utils';
import type { StudioBadge } from './speaker-studio-state';

export function StudioTitle({
  name,
  badge,
  className,
}: {
  name: string;
  badge: StudioBadge;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center text-center', className)}>
      <LiveBadge live={badge.live} showDot={badge.showDot} label={badge.label} />
      <h1 className="mt-4 max-w-full break-words text-screen lg:mt-3.5 lg:text-hero">{name}</h1>
    </div>
  );
}
