import type { paths } from '@linguacast/contract/openapi'; // type-only, zero runtime
import createFetchClient from 'openapi-fetch';
import createQueryClient from 'openapi-react-query';

// credentials: 'include' is set now although nothing authenticates yet. It is
// same-origin and inert until the admin session cookie exists, and setting it
// later is the kind of thing that gets forgotten until a login mysteriously fails.
export const fetchClient = createFetchClient<paths>({ baseUrl: '/api', credentials: 'include' });
export const $api = createQueryClient(fetchClient);
