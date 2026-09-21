import type { components } from '@hallspeak/contract/openapi';
import { Link } from '@tanstack/react-router';
import { Pin } from '@/components/pin';
import { cn } from '@/lib/utils';

type AdminEventDetail = components['schemas']['AdminEventDetail'];

export function ListenerEventLink({ event }: { event: AdminEventDetail }) {
  return (
    <Link
      to="/events/$pin"
      params={{ pin: event.pin }}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open the listener page for ${event.name} in a new tab`}
      className="hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
    >
      <Pin pin={event.pin} />
    </Link>
  );
}

export function EventNameLink({
  event,
  className,
}: {
  event: AdminEventDetail;
  className?: string;
}) {
  return (
    <Link
      to="/admin/events/$id"
      params={{ id: event.id }}
      className={cn(
        'font-semibold hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2',
        className,
      )}
    >
      {event.name}
    </Link>
  );
}
