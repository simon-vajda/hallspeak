import { createFileRoute, Link } from '@tanstack/react-router';
import { $api } from '@/api/client';

export const Route = createFileRoute('/admin/events/')({ component: AdminEventsPage });

// PLACEHOLDER. Spec E ships the admin REST API; the admin UI is a later spec. This
// exists so the route and its data path are real, not so it is usable.
//
// Unguarded, like the API behind it — /admin and /api/admin share a prefix precisely so
// authentication lands as one boundary rather than a per-route audit (spec E §4).
function AdminEventsPage() {
  const { data, isPending, isError } = $api.useQuery('get', '/admin/events');

  if (isPending) return <p>Loading…</p>;
  if (isError || !data) return <p>Could not load events.</p>;

  return (
    <main className="mx-auto max-w-2xl space-y-2 p-8">
      <h1 className="text-xl">Events</h1>
      <ul>
        {data.map((event) => (
          <li key={event.id}>
            <Link to="/admin/events/$id" params={{ id: String(event.id) }}>
              {event.name}
            </Link>{' '}
            — pin {event.pin} — {event.enabled ? 'enabled' : 'disabled'}
          </li>
        ))}
      </ul>
    </main>
  );
}
