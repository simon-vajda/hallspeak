import { AppHeader } from '@/components/app-header';
import { LiveBadge } from '@/components/live-badge';
import { VersionFooter } from '@/components/version-footer';

/**
 * Only the organiser reaches this screen: they regenerated the speaker code or disabled the
 * channel, and neither is something this session can undo by reconnecting. A handover is
 * not displacement — it returns the studio to pre-flight, free to ask for the channel back.
 */
export function SpeakerDisplaced({ channelName }: { channelName: string }) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-shell flex-1 flex-col items-center justify-center px-gutter pb-16 text-center lg:px-10">
        <LiveBadge live={false} showDot={false} label="Interpreter · off air" />
        <h1 className="mt-4 mb-2 text-screen lg:text-screen-lg">{channelName} session ended</h1>
        <p className="max-w-100 text-sm text-muted-foreground">
          The organiser ended this session — the speaker code was changed, or the channel was
          switched off. Reload this page to try again, and ask the organiser for the current speaker
          link if it no longer works.
        </p>
      </main>

      <VersionFooter />
    </div>
  );
}
