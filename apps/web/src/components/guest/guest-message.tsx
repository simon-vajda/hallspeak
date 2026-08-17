import type { ReactElement, ReactNode } from 'react';
import { AppHeader } from '@/components/app-header';
import { TempThemeToggle } from '@/components/temp-theme-toggle';
import { Button } from '@/components/ui/button';

/**
 * The frame both guest routes put their non-screen states in. The listener room does not use
 * it: its own frame carries a back link, the channel strip and a centred main.
 */
export function GuestShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="absolute top-3.5 right-gutter z-10 lg:top-4 lg:right-10">
        <TempThemeToggle />
      </div>

      <AppHeader />

      <main className="flex flex-1 flex-col px-gutter pt-7 pb-gutter lg:px-10 lg:pt-15 lg:pb-16.5">
        {children}
      </main>
    </div>
  );
}

/** A guest-facing dead end or wait: a mistyped PIN, a stale speaker link, a pending fetch. */
export function GuestMessage({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <GuestShell>
      <h1 className="text-screen lg:max-w-117.5 lg:text-screen-lg">{title}</h1>
      <p className="mt-2.5 max-w-115 text-sm leading-normal text-muted-foreground lg:text-[17px] lg:leading-[1.6]">
        {body}
      </p>
      {children}
    </GuestShell>
  );
}

/**
 * `link` is the whole `<Link>` element rather than a route and params, so each caller keeps
 * TanStack's typed navigation.
 */
export function GuestMessageAction({
  link,
  children,
}: {
  link: ReactElement;
  children: ReactNode;
}) {
  return (
    <Button
      variant="outline"
      size="pill"
      // It renders as an anchor, so Base UI must stop expecting a native <button>.
      nativeButton={false}
      render={link}
      className="mt-8 w-full lg:w-50"
    >
      {children}
    </Button>
  );
}
