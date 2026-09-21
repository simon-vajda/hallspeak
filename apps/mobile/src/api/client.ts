import type { paths } from '@hallspeak/contract/openapi';
import createFetchClient, { type Client } from 'openapi-fetch';
import { unavailable } from './problem';

/**
 * A factory over a host, never a module singleton. The web client hardcodes `baseUrl: '/api'`
 * and `credentials: 'include'`, both of which are same-origin browser assumptions; this app
 * takes the host from the route, and the listener has no session to send.
 *
 * HTTPS is not a choice the app offers: every LinguaCast server is reachable over it.
 */
export function apiOrigin(host: string): string {
  return `https://${host}`;
}

export function apiBaseUrl(host: string): string {
  return `${apiOrigin(host)}/api`;
}

/** `fetchImpl` exists so the two middlewares can be driven without a network. */
export function createApiClient(host: string, fetchImpl?: typeof fetch): Client<paths> {
  const client = createFetchClient<paths>({
    baseUrl: apiBaseUrl(host),
    ...(fetchImpl ? { fetch: fetchImpl } : {}),
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

    onError() {
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
