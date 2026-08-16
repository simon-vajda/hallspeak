import type { ReactNode } from 'react';
import { GuestHeader } from '@/components/guest/guest-header';
import { TempThemeToggle } from '@/components/temp-theme-toggle';

/**
 * The frame both guest routes put their non-screen states in — the lockup bar, the theme
 * toggle and the content column. The listener room does not use it: its frame carries a
 * back link, the channel strip and a centred main, so parameterising this one for it would
 * leave a shell in name only.
 */
export function GuestShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="absolute top-3.5 right-gutter z-10 lg:top-4 lg:right-10">
        <TempThemeToggle />
      </div>

      <GuestHeader />

      <main className="flex flex-1 flex-col px-gutter pt-7 pb-gutter lg:px-10 lg:pt-15 lg:pb-16.5">
        {children}
      </main>
    </div>
  );
}

/**
 * A guest-facing dead end or wait: a title, a line of copy, and whatever way out the
 * caller wants. Both public routes hit these — a mistyped PIN, a stale speaker link, the
 * gap before the first response — so they are drawn rather than left as bare text.
 */
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
      <h1 className="text-screen lg:max-w-117.5 lg:text-[52px] lg:leading-[1.03] lg:tracking-[-0.045em]">
        {title}
      </h1>
      <p className="mt-2.5 max-w-115 text-sm leading-normal text-muted-foreground lg:text-[17px] lg:leading-[1.6]">
        {body}
      </p>
      {children}
    </GuestShell>
  );
}
