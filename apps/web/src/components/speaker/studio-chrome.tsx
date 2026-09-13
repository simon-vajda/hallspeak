import { AppHeader } from '@/components/app-header';
import { TempThemeToggle } from '@/components/temp-theme-toggle';
import { formatPin } from '@/lib/format';

/** The event is named here and only here, so the title block below is the channel alone. */
export function StudioChrome({ eventName, pin }: { eventName: string; pin: string }) {
  return (
    <>
      <AppHeader
        right={
          <>
            <span className="text-meta text-muted-foreground">
              {eventName} · PIN {formatPin(pin)}
            </span>
            <TempThemeToggle />
          </>
        }
      />
      <div className="mx-auto flex w-full max-w-shell items-center justify-end gap-3 px-gutter pt-6 lg:hidden">
        <span className="min-w-0 truncate text-meta text-muted-foreground">{eventName}</span>
        <TempThemeToggle />
      </div>
    </>
  );
}
