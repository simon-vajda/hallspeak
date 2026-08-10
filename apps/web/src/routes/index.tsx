import { unwrap } from '@linguacast/contract/socket';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { $api } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { socket } from '@/lib/signal';

export const Route = createFileRoute('/')({ component: IndexPage });

type Status = 'connecting' | 'connected' | 'error';

/**
 * Drives the socket so `pnpm dev` visibly exercises the whole path:
 * handshake → validate → handle → ack → unwrap.
 *
 * Under StrictMode this effect runs twice in dev, so the socket connects, disconnects
 * and reconnects on mount. That is expected and harmless.
 */
function useSignal() {
  const [status, setStatus] = useState<Status>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [rttMs, setRttMs] = useState<number | null>(null);

  useEffect(() => {
    function onConnect() {
      setStatus('connected');
      setError(null);
    }
    function onDisconnect() {
      setStatus('connecting');
      setRttMs(null);
    }
    // Carries the handshake gate's rejection: 'client_too_old' or 'invalid_handshake'.
    function onConnectError(err: Error) {
      setStatus('error');
      setError(err.message);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (status !== 'connected') return;
    let cancelled = false;
    const started = performance.now();

    socket
      .emitWithAck('ping', {})
      .then((res) => {
        // Typed Ack<{ serverTime: number }> with no annotation. unwrap throws
        // SignalError on an application failure; a timeout or disconnect rejects with
        // Socket.IO's own Error. Both land in the catch below.
        unwrap(res);
        if (!cancelled) setRttMs(Math.round(performance.now() - started));
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
  }, [status]);

  return { status, error, rttMs };
}

function IndexPage() {
  // '/version', not '/api/version': the client's baseUrl supplies the prefix.
  // `error` is deliberately untouched — getVersion declares no non-2xx response,
  // so openapi-react-query types it `never` and any property access fails to compile.
  const { data, isPending, isError } = $api.useQuery('get', '/version');
  const { status, error, rttMs } = useSignal();

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
              <dt className="text-muted-foreground">minClientVersion</dt>
              <dd className="font-mono">{data.minClientVersion}</dd>
              <dt className="text-muted-foreground">serverVersion</dt>
              <dd className="font-mono">{data.serverVersion}</dd>
            </dl>
          ) : null}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 border-t pt-4 text-sm">
            <dt className="text-muted-foreground">signal</dt>
            <dd className={status === 'error' ? 'font-mono text-destructive' : 'font-mono'}>
              {status}
            </dd>
            <dt className="text-muted-foreground">ping</dt>
            <dd className="font-mono">{rttMs === null ? '—' : `${rttMs} ms`}</dd>
          </dl>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
        </CardContent>
      </Card>
    </main>
  );
}
