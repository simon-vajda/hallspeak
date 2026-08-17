import { cn } from '@/lib/utils';

/** Larger on a phone, where it stands alone; smaller from `lg`, where it sits in a header bar. */
export function LogoLockup({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="size-6.5 rounded-full bg-primary lg:size-5.5" />
      {/* leading-none so the circle, not the body line-height, sets the lockup's height. */}
      <span className="text-lg leading-none font-semibold tracking-[-0.03em] lg:text-section">
        LinguaCast
      </span>
    </div>
  );
}
