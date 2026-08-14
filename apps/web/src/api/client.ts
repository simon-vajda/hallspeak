import type { paths } from '@linguacast/contract/openapi'; // type-only, zero runtime
import createFetchClient from 'openapi-fetch';
import createQueryClient from 'openapi-react-query';

// credentials: 'include' is set now although nothing authenticates yet. It is
// same-origin and inert until the admin session cookie exists, and setting it
// later is the kind of thing that gets forgotten until a login mysteriously fails.
export const fetchClient = createFetchClient<paths>({ baseUrl: '/api', credentials: 'include' });

/**
 * Gives a body-less failure a body, so it is still a failure by the time it reaches a hook.
 *
 * openapi-fetch returns `{ error: undefined }` for a non-ok response with an empty body, and
 * openapi-react-query only throws `if (error)` — so a 502 or 504 from a reverse proxy, which
 * is what the browser sees whenever the server is down, resolves as a **success** carrying
 * `undefined`. Optimistic writes then keep their optimistic value, no rollback runs and no
 * error is reported: the UI claims a change the server never accepted.
 *
 * Our own errors always carry a Problem body and are unaffected.
 */
fetchClient.use({
  async onResponse({ response }) {
    if (response.ok || (await response.clone().text()) !== '') return;

    return new Response(
      JSON.stringify({ code: 'unavailable', message: `The server returned ${response.status}.` }),
      {
        status: response.status,
        statusText: response.statusText,
        headers: { 'content-type': 'application/json' },
      },
    );
  },
});

export const $api = createQueryClient(fetchClient);
