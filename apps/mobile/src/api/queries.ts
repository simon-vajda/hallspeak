import { queryOptions } from '@tanstack/react-query';
import { apiFor } from './client';
import type { Problem } from './problem';

/**
 * Every key carries the host as well as the PIN. Two congregations can run the same PIN on
 * different servers, and a key that dropped the host would hand one event's payload to the
 * other. `openapi-react-query`'s own `queryOptions` keys on method, path and parameters
 * alone, which is why these are built here instead.
 */
export const eventQueryKey = (host: string, pin: string) => ['event', host, pin] as const;

export const channelQueryKey = (host: string, pin: string, slug: string) =>
  ['channel', host, pin, slug] as const;

export const serverVersionQueryKey = (host: string) => ['server-version', host] as const;

/** The error a query rejects with is always the server's Problem, or the client's own. */
function unwrap<T>(result: { data?: T; error?: unknown }): T {
  if (result.data === undefined) {
    throw result.error as Problem;
  }

  return result.data;
}

export const eventQueryOptions = (host: string, pin: string) =>
  queryOptions({
    queryKey: eventQueryKey(host, pin),
    queryFn: async ({ signal }) =>
      unwrap(await apiFor(host).GET('/events/{pin}', { params: { path: { pin } }, signal })),
  });

export const serverVersionQueryOptions = (host: string) =>
  queryOptions({
    queryKey: serverVersionQueryKey(host),
    queryFn: async ({ signal }) => unwrap(await apiFor(host).GET('/version', { signal })),
  });

export const channelQueryOptions = (host: string, pin: string, slug: string) =>
  queryOptions({
    queryKey: channelQueryKey(host, pin, slug),
    queryFn: async ({ signal }) =>
      unwrap(
        await apiFor(host).GET('/events/{pin}/{slug}', {
          params: { path: { pin, slug }, query: {} },
          signal,
        }),
      ),
  });
