import { createFileRoute } from '@tanstack/react-router';
import { $api } from '@/api/client';

export const Route = createFileRoute('/admin/events/$id')({ component: AdminEventPage });

// PLACEHOLDER — see admin.events.index.tsx.
function AdminEventPage() {
  const { id } = Route.useParams();
  const { data, isPending, isError } = $api.useQuery('get', '/admin/events/{id}', {
    params: { path: { id: Number(id) } },
  });

  if (isPending) return <p>Loading…</p>;
  if (isError || !data) return <p>Not found.</p>;

  return (
    <main className="mx-auto max-w-2xl space-y-2 p-8">
      <h1 className="text-xl">{data.name}</h1>
      <p>pin {data.pin}</p>
      <ul>
        {data.channels.map((channel) => (
          <li key={channel.id}>
            {channel.name} ({channel.slug}) — {channel.enabled ? 'enabled' : 'disabled'} — speaker
            code {channel.speakerCode}
          </li>
        ))}
      </ul>
    </main>
  );
}
