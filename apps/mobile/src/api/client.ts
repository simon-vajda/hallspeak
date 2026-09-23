import type { paths } from '@hallspeak/contract/openapi';
import createFetchClient, { type Client } from 'openapi-fetch';
import { unavailable } from './problem';

/**
 * A factory over a host, never a module singleton. The web client hardcodes `baseUrl: '/api'`
 * and `credentials: 'include'`, both of which are same-origin browser assumptions; this app
 * takes the host from the route, and the listener has no session to send.
 *
 * HTTPS is not a choice the app offers: every Hallspeak server is reachable over it.
 */
export function apiOrigin(host: string): string {
  return `https://${host}`;
}

export function apiBaseUrl(host: string): string {
  return `${apiOrigin(host)}/api`;
}

/**
 * How long one attempt waits for a response before it counts as unreachable. React Native's
 * fetch has no deadline of its own, so a server that accepts the connection and never answers
 * would otherwise hold a screen in its loading state indefinitely.
 */
export const REQUEST_TIMEOUT_MS = 8_000;

class RequestTimeoutError extends Error {
  override name = 'RequestTimeoutError';
}

function abortError(): Error {
  const error = new Error('The request was aborted.');
  error.name = 'AbortError';

  return error;
}

/**
 * openapi-fetch hands its fetch a built `Request`, so the caller's cancellation arrives as
 * that request's signal. The attempt listens to it and to its own deadline, and settles on
 * whichever comes first even if the underlying fetch ignores the abort.
 */
function withTimeout(fetchImpl: typeof fetch): typeof fetch {
  return (input, init) => {
    const callerSignal = input instanceof Request ? input.signal : (init?.signal ?? undefined);
    const controller = new AbortController();

    return new Promise<Response>((resolve, reject) => {
      const settle = () => {
        clearTimeout(timer);
        callerSignal?.removeEventListener('abort', onCallerAbort);
      };
      const onCallerAbort = () => {
        settle();
        controller.abort();
        reject(abortError());
      };
      const timer = setTimeout(() => {
        settle();
        controller.abort();
        reject(new RequestTimeoutError('The server did not answer in time.'));
      }, REQUEST_TIMEOUT_MS);

      if (callerSignal?.aborted) {
        onCallerAbort();
        return;
      }
      callerSignal?.addEventListener('abort', onCallerAbort);

      const request =
        input instanceof Request
          ? new Request(input, { signal: controller.signal })
          : new Request(input, { ...init, signal: controller.signal });

      fetchImpl(request, input instanceof Request ? init : undefined).then(
        (response) => {
          settle();
          resolve(response);
        },
        (error: unknown) => {
          settle();
          reject(error);
        },
      );
    });
  };
}

/** `fetchImpl` exists so the two middlewares can be driven without a network. */
export function createApiClient(host: string, fetchImpl: typeof fetch = fetch): Client<paths> {
  const client = createFetchClient<paths>({
    baseUrl: apiBaseUrl(host),
    fetch: withTimeout(fetchImpl),
  });

  client.use({
    // openapi-fetch returns `{ error: undefined }` for a non-ok response with an empty body,
    // so a bare 502 from a reverse proxy would otherwise resolve as a success.
    async onResponse({ response }) {
      if (response.ok || (await response.clone().text()) !== '') {
        return;
      }

      return unavailable(response.status, `The server returned ${response.status}.`);
    },

    onError({ request, error }) {
      // Returning nothing rethrows the original: a cancelled query must reject as cancelled,
      // not settle as a failure that would mark the event unreachable.
      if (request.signal.aborted && !(error instanceof RequestTimeoutError)) {
        return;
      }

      // 503 is this client's own word for it: no status ever arrived to report.
      return unavailable(503, 'The server could not be reached.');
    },
  });

  return client;
}

const clients = new Map<string, Client<paths>>();

/** Memoized per host, so two screens on the same event share one client. */
export function apiFor(host: string): Client<paths> {
  const existing = clients.get(host);

  if (existing) {
    return existing;
  }

  const created = createApiClient(host);
  clients.set(host, created);

  return created;
}
