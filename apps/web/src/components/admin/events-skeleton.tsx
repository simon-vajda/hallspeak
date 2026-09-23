import { MICRO_LABEL } from '@/components/micro-label';
import { Skeleton } from '@/components/ui/skeleton';
import { ADMIN_EVENT_TABLE_COLUMNS } from '@/lib/admin-event-list';
import { cn } from '@/lib/utils';

const ROWS = [0, 1, 2, 3];

/** Invisible text sets each block to the loaded element's line height. */
function Line({ className, text }: { className: string; text: string }) {
  return (
    <Skeleton className={cn('rounded-full', className)}>
      <span className="invisible">{text}</span>
    </Skeleton>
  );
}

export function EventsSkeleton() {
  return (
    <div>
      <p role="status" className="sr-only">
        Loading events
      </p>

      <div aria-hidden>
        <header>
          <h1 className="text-screen">Events</h1>
          <Line className="mt-1 w-48 text-sm" text="Events" />
        </header>

        <ul className="mt-5 flex flex-col gap-3 lg:hidden">
          {ROWS.map((row) => (
            <li key={row}>
              <Skeleton className="rounded-lg px-5 py-4.5">
                <div className="invisible">
                  <div className="text-subtitle">Event</div>
                  <p className="mt-0.5 text-note">PIN</p>
                  <div className="mt-3 h-7" />
                  <p className="mt-3 text-meta">Status</p>
                </div>
              </Skeleton>
            </li>
          ))}
        </ul>

        <div className="mt-6 hidden lg:block">
          <div className={cn('grid px-5 pb-2.5', MICRO_LABEL, ADMIN_EVENT_TABLE_COLUMNS)}>
            <span>Event</span>
            <span>PIN</span>
            <span>Channels</span>
            <span>Status</span>
            <span className="text-right">Enabled</span>
          </div>
          <ul>
            {ROWS.map((row) => (
              <li
                key={row}
                className={cn(
                  'grid items-center gap-4 border-t border-border px-5 py-4.5',
                  ADMIN_EVENT_TABLE_COLUMNS,
                )}
              >
                <Line className="w-3/4 text-subtitle" text="Event" />
                <Line className="w-2/3 text-base" text="000 000" />
                <Line className="w-3/4 text-meta" text="Channels" />
                <Line className="w-2/3 text-meta" text="Status" />
                <div className="flex justify-end">
                  <Skeleton className="h-6 w-11 rounded-full" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
