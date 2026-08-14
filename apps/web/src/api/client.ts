import type { paths } from '@linguacast/contract/openapi'; // type-only, zero runtime
import createFetchClient from 'openapi-fetch';
import createQueryClient from 'openapi-react-query';

// credentials: 'include' is set now although nothing authenticates yet. It is
// same-origin and inert until the admin session cookie exists, and setting it
// later is the kind of thing that gets forgotten until a login mysteriously fails.
export const fetchClient = createFetchClient<paths>({ baseUrl: '/api', credentials: 'include' });

/**
 * `unavailable` is the code for "the API never answered" — the request did not reach it, or
 * what came back was not from it. Every other error carries a Problem the server wrote.
 */
function unavailable(status: number, message: string) {
  return new Response(JSON.stringify({ code: 'unavailable', message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * Makes a failure that carries no Problem body still arrive as a failure.
 *
 * openapi-fetch returns `{ error: undefined }` for a non-ok response with an empty body, and
 * openapi-react-query only throws `if (error)` — so a 502 or 504 from a reverse proxy, which
 * is what the browser sees whenever the server is down, resolved as a **success** carrying
 * `undefined`. Optimistic writes kept their optimistic value, no rollback ran and nothing was
 * reported: the UI claimed a change the server never accepted.
 *
 * `onError` covers the other half of the same story — a fetch that rejects outright, with no
 * response at all, because the browser is offline or the connection was refused. Both end up
 * as one `unavailable` Problem, so a caller has one shape to handle and one code to check.
 */
fetchClient.use({
  async onResponse({ response }) {
    if (response.ok || (await response.clone().text()) !== '') return;

    return unavailable(response.status, `The server returned ${response.status}.`);
  },

  onError() {
    // 503 is this client's own word for it: no status ever arrived to report.
    return unavailable(503, 'The server could not be reached.');
  },
});

export const $api = createQueryClient(fetchClient);
