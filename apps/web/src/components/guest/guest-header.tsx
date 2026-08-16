import { LogoLockup } from '@/components/logo-lockup';
import { cn } from '@/lib/utils';

/**
 * The guest screens' header bar. It exists from `lg` only: on a phone the design gives the
 * content column the full height and no lockup, so this renders nothing there.
 */
export function GuestHeader({ className }: { className?: string }) {
  return (
    <header className={cn('hidden border-b border-border px-10 py-4 lg:block', className)}>
      <LogoLockup />
    </header>
  );
}
