import { createFileRoute } from '@tanstack/react-router';
import { $api } from '@/api/client';

export const Route = createFileRoute('/')({ component: IndexPage });

function IndexPage() {
  const { data, isPending, isError } = $api.useQuery('get', '/version');

  return (
    <main>
      <h1>LinguaCast</h1>
      {isPending ? <p>Loading…</p> : null}
      {isError ? <p>Could not reach the API.</p> : null}
      {data ? (
        <dl>
          <dt>apiVersion</dt>
          <dd>{data.apiVersion}</dd>
          <dt>minClientVersion</dt>
          <dd>{data.minClientVersion}</dd>
          <dt>serverVersion</dt>
          <dd>{data.serverVersion}</dd>
        </dl>
      ) : null}
    </main>
  );
}
