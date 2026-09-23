import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const CHANNEL_ROWS = [0, 1, 2];

/** Invisible text sets each block to the loaded element's line height. */
function Line({ className, text }: { className: string; text: string }) {
  return (
    <Skeleton className={cn('rounded-full', className)}>
      <span className="invisible">{text}</span>
    </Skeleton>
  );
}

export function EventDetailSkeleton() {
  return (
    <div>
      <p role="status" className="sr-only">
        Loading event
      </p>

      <div aria-hidden>
        <Line className="w-40 text-meta" text="Events" />

        <header className="mt-2.5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-7.5">
          <div className="lg:w-140">
            <Line className="w-3/5 text-screen" text="Event" />
            <Line className="mt-2 w-4/5 text-sm leading-relaxed" text="Description" />
          </div>
          <div className="flex gap-2.5 lg:flex-none">
            <Skeleton className="h-11 flex-1 rounded-full lg:h-action lg:w-24 lg:flex-none" />
            <Skeleton className="h-11 flex-1 rounded-full lg:h-action lg:w-24 lg:flex-none" />
          </div>
        </header>

        <div className="mt-6.5 grid items-start gap-5.5 lg:grid-cols-[1fr_330px]">
          <Skeleton className="order-2 overflow-hidden rounded-lg lg:order-none">
            <div className="invisible flex items-center justify-between gap-3 px-panel py-4.5">
              <span className="text-section">Channels</span>
              <span className="h-action w-32" />
            </div>
            {CHANNEL_ROWS.map((row) => (
              <div key={row} className="border-t border-background px-panel py-4.25">
                <div className="invisible">
                  <div className="text-subtitle">Channel</div>
                  <div className="mt-1 text-xs">Link</div>
                </div>
              </div>
            ))}
          </Skeleton>

          <div className="order-1 flex flex-col gap-3.5 lg:order-none">
            <Skeleton className="h-109 rounded-lg" />
            <Skeleton className="rounded-lg px-5 py-4.5">
              <div className="invisible">
                <div className="text-section">Event enabled</div>
                <p className="mt-0.5 text-note">Guests can join right now</p>
              </div>
            </Skeleton>
          </div>
        </div>
      </div>
    </div>
  );
}
