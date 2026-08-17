import type { ReactNode } from 'react';
import { LogoLockup } from '@/components/logo-lockup';
import { cn } from '@/lib/utils';

/**
 * From `lg` only: on a phone the content column gets the full height and no lockup. `right` is
 * a slot rather than props because on a phone its content sits beside the back button instead.
 */
export function AppHeader({ right, className }: { right?: ReactNode; className?: string }) {
  return (
    <header
      className={cn(
        'hidden items-center justify-between border-b border-border px-10 py-4 lg:flex',
        className,
      )}
    >
      <LogoLockup />
      {right}
    </header>
  );
}
