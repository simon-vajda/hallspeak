import type { ReactNode } from 'react';
import { LogoLockup } from '@/components/logo-lockup';
import { cn } from '@/lib/utils';

/**
 * From `lg` only: on a phone the content column gets the full height and no lockup. `right` is
 * a slot rather than props because on a phone its content sits beside the back button instead —
 * and because the theme toggle rides in it here, where `items-center` centres it against the
 * lockup. A phone has no bar to centre against, so there it is positioned over the content.
 */
export function AppHeader({ right, className }: { right?: ReactNode; className?: string }) {
  return (
    <header className={cn('hidden border-b border-border lg:block', className)}>
      <div className="mx-auto flex w-full max-w-shell items-center justify-between px-10 py-4">
        <LogoLockup />
        {/* The toggle is taller than the lockup, so it is pulled back into the line rather than
            allowed to set the bar's height. */}
        <div className="-my-1.5 flex items-center gap-3.5">{right}</div>
      </div>
    </header>
  );
}
