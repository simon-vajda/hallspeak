import { GuestShell } from '@/components/guest/guest-message';
import { MICRO_LABEL } from '@/components/micro-label';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { CHANNEL_ROW, CHANNEL_ROW_NAME } from './channel-row';

const ROW_COUNT = 3;

/**
 * Each block wraps invisible text set in the loaded element's type step, so it takes that
 * element's exact line height and the swap to real content moves nothing.
 */
export function EventSkeleton() {
  return (
    <GuestShell>
      <p role="status" className="sr-only">
        Loading event
      </p>

      <div aria-hidden className="grid items-start gap-6 lg:grid-cols-2 lg:gap-16">
        <div className="lg:max-w-117.5">
          <Skeleton className="mb-2.5 w-3/5 rounded-full text-screen lg:mb-3.5 lg:text-screen-lg">
            <span className="invisible">Event</span>
          </Skeleton>
          <Skeleton className="mb-2 w-4/5 rounded-full text-sm leading-normal lg:mb-6 lg:text-body-lg">
            <span className="invisible">Description</span>
          </Skeleton>
          <Skeleton className="inline-flex rounded-full px-3 py-1.5 text-meta lg:px-4.5 lg:py-2.5 lg:text-note">
            <span className="invisible">PIN 000 000</span>
          </Skeleton>
        </div>

        <div className="flex flex-col gap-2.5 lg:gap-3">
          <h2 className={MICRO_LABEL}>Choose a channel</h2>
          {Array.from({ length: ROW_COUNT }, (_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed count of identical blocks
            <Skeleton key={index} className={cn(CHANNEL_ROW, 'rounded-lg')}>
              <span className="size-2.5 shrink-0" />
              <div className="invisible flex-1">
                <div className={CHANNEL_ROW_NAME}>Channel</div>
                <div className="mt-px text-note lg:mt-0.5">Offline</div>
              </div>
              <span className="size-9 lg:size-11" />
            </Skeleton>
          ))}
        </div>
      </div>

      <p className="invisible mt-auto pt-10 text-note lg:max-w-95" aria-hidden>
        Channels turn on when their interpreter connects. Leave this page open — it updates on its
        own.
      </p>
    </GuestShell>
  );
}
