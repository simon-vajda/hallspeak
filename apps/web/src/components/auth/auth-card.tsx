import type { ReactNode } from 'react';
import { LogoLockup } from '@/components/logo-lockup';
import { TempThemeToggle } from '@/components/temp-theme-toggle';
import { VersionFooter } from '@/components/version-footer';
import { cn } from '@/lib/utils';

/** The shell both auth screens share. */
export function AuthCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-border px-gutter py-4 lg:px-10 lg:py-4.5">
        <LogoLockup />
        <TempThemeToggle />
      </header>

      <main className="flex flex-1 justify-center px-gutter py-8 lg:px-10 lg:py-18">
        <div
          className={cn(
            'flex h-fit w-full flex-col rounded-lg border border-border bg-card p-6 lg:p-8.5',
            className,
          )}
        >
          {children}
        </div>
      </main>

      <VersionFooter />
    </div>
  );
}
