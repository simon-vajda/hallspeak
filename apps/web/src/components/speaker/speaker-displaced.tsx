import { AppHeader } from '@/components/app-header';
import { LiveBadge } from '@/components/live-badge';
import { TempThemeToggle } from '@/components/temp-theme-toggle';
import { VersionFooter } from '@/components/version-footer';

/** A takeover is a dead end: reclaiming automatically would alternate between two devices. */
export function SpeakerDisplaced({
  channelName,
  eventName,
}: {
  channelName: string;
  eventName: string;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="absolute top-3.5 right-gutter z-10 lg:hidden">
        <TempThemeToggle />
      </div>

      <AppHeader
        right={
          <>
            <span className="text-meta text-muted-foreground">{eventName}</span>
            <TempThemeToggle />
          </>
        }
      />

      <main className="mx-auto flex w-full max-w-shell flex-1 flex-col items-center justify-center px-gutter pb-16 text-center lg:px-10">
        <LiveBadge live={false} showDot={false} label="Interpreter · off air" />
        <h1 className="mt-4 mb-2 text-screen lg:text-screen-lg">{channelName} was handed over</h1>
        <p className="max-w-100 text-sm text-muted-foreground">
          This session stopped — either another device opened the same speaker link, or the
          organiser changed it. It will not take the channel back on its own. Reload this page to
          try again, and ask the organiser if the link no longer works.
        </p>
      </main>

      <VersionFooter />
    </div>
  );
}
