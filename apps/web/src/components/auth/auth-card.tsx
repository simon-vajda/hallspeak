import type { ReactNode } from 'react';
import { LogoLockup } from '@/components/logo-lockup';
import { TempThemeToggle } from '@/components/temp-theme-toggle';
import { cn } from '@/lib/utils';

/** The pill field from `12g`, shared by both screens: 52px, filled at rest, a two-pixel
 * ring on focus — the same treatment as the PIN boxes on the home screen. */
export const AUTH_FIELD =
  'h-13 rounded-full border-2 border-transparent bg-secondary px-5 text-base focus-visible:border-primary focus-visible:bg-card focus-visible:ring-0 aria-invalid:border-destructive aria-invalid:ring-0';

export const AUTH_LABEL = 'text-label text-muted-foreground uppercase';

/**
 * The shell both auth screens share. The host line names the machine the installer typed
 * into, which is the only way either screen says which server this is.
 */
export function AuthCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-border px-gutter py-4 lg:px-10 lg:py-4.5">
        <LogoLockup />
        <div className="flex items-center gap-4">
          <span className="text-meta text-muted-foreground">{window.location.host}</span>
          <TempThemeToggle />
        </div>
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
    </div>
  );
}
