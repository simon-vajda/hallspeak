import { createFileRoute } from '@tanstack/react-router';
import { $api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const Route = createFileRoute('/')({ component: IndexPage });

// Placeholder home. The product entry points are the printed PIN and the QR code, so
// this page has no job yet beyond proving the API is reachable.
function IndexPage() {
  // '/version', not '/api/version': the client's baseUrl supplies the prefix.
  const { data, isPending, isError } = $api.useQuery('get', '/version');

  return (
    <main className="mx-auto max-w-md p-8">
      <Card>
        <CardHeader>
          <CardTitle>LinguaCast</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isPending ? <p className="text-muted-foreground">Loading…</p> : null}
          {isError ? <p className="text-destructive">Could not reach the API.</p> : null}
          {data ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">apiVersion</dt>
              <dd className="font-mono">{data.apiVersion}</dd>
              <dt className="text-muted-foreground">serverVersion</dt>
              <dd className="font-mono">{data.serverVersion}</dd>
            </dl>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
