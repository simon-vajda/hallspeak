import type { ReactElement, ReactNode } from 'react';
import { AppHeader } from '@/components/app-header';
import { Button } from '@/components/ui/button';
import { VersionFooter } from '@/components/version-footer';

/**
 * The frame both guest routes put their non-screen states in. The listener room does not use
 * it: its header carries a back link and its main is centred.
 */
export function GuestShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-shell flex-1 flex-col px-gutter pt-7 pb-gutter lg:px-10 lg:pt-15 lg:pb-16.5">
        {children}
      </main>

      <VersionFooter />
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
      <p className="mt-2.5 max-w-115 text-sm leading-normal text-muted-foreground lg:text-body-lg">
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
