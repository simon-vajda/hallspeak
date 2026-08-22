import type { paths } from '@linguacast/contract/openapi';
import createFetchClient from 'openapi-fetch';
import createQueryClient from 'openapi-react-query';

// The admin session rides on a cookie, so every call has to carry it.
export const fetchClient = createFetchClient<paths>({ baseUrl: '/api', credentials: 'include' });

let onUnauthenticated: (() => void) | undefined;

/**
 * Handed in from main.tsx after the router exists rather than imported: this module cannot
 * reach the router, and invalidating the session query alone would refetch it without
 * re-running any route guard — which is what would leave the five-second live poll failing
 * forever instead of redirecting once.
 */
export function setUnauthenticatedHandler(handler: () => void): void {
  onUnauthenticated = handler;
}

/** `unavailable` means the API never answered. Every other error carries a Problem it wrote. */
function unavailable(status: number, message: string) {
  return new Response(JSON.stringify({ code: 'unavailable', message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * Makes a failure that carries no Problem body still arrive as a failure. openapi-fetch returns
 * `{ error: undefined }` for a non-ok response with an empty body and openapi-react-query only
 * throws `if (error)`, so a bare 502 from a reverse proxy resolved as a success. `onError`
 * covers the other half: a fetch that rejects with no response at all.
 */
fetchClient.use({
  async onResponse({ request, response }) {
    // The auth routes answer 401 as their own business — a wrong password is not a dead
    // session, and treating it as one would refetch and re-guard on every failed attempt.
    if (response.status === 401 && !new URL(request.url).pathname.startsWith('/api/auth/')) {
      onUnauthenticated?.();
    }

    if (response.ok || (await response.clone().text()) !== '') return;

    return unavailable(response.status, `The server returned ${response.status}.`);
  },

  onError() {
    // 503 is this client's own word for it: no status ever arrived to report.
    return unavailable(503, 'The server could not be reached.');
  },
});

export const $api = createQueryClient(fetchClient);
