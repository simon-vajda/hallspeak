import type { ReactNode } from 'react';
import { LogoLockup } from '@/components/logo-lockup';
import { TempThemeToggle } from '@/components/temp-theme-toggle';
import { cn } from '@/lib/utils';

export function AppHeader({ left, className }: { left?: ReactNode; className?: string }) {
  return (
    <header
      className={cn('sticky top-0 z-40 h-header border-b border-border bg-background', className)}
    >
      <div className="mx-auto flex h-full w-full max-w-shell items-center justify-between gap-3 px-gutter lg:px-10">
        <div className="flex min-w-0 items-center">{left ?? <LogoLockup />}</div>
        <div className="shrink-0">
          <TempThemeToggle />
        </div>
      </div>
    </header>
  );
}
