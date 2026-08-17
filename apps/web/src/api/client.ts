import type { paths } from '@linguacast/contract/openapi';
import createFetchClient from 'openapi-fetch';
import createQueryClient from 'openapi-react-query';

// credentials: 'include' is inert until the admin session cookie exists, and adding it later
// is the kind of thing that gets forgotten until a login mysteriously fails.
export const fetchClient = createFetchClient<paths>({ baseUrl: '/api', credentials: 'include' });

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
