import logoMark from '@/assets/logo-mark.svg';
import { cn } from '@/lib/utils';

/** Larger on a phone, where it stands alone; smaller from `lg`, where it sits in a header bar. */
export function LogoLockup({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <img src={logoMark} alt="" className="h-6.5 w-auto lg:h-5.5" />
      {/* leading-none so the mark, not the body line-height, sets the lockup's height. */}
      <span className="text-xl leading-none font-semibold tracking-[-0.03em] lg:text-lg">
        Hallspeak
      </span>
    </div>
  );
}
