import { $api } from '@/api/client';

/**
 * Unauthenticated and cheap, and the one thing every guard reads: whether this server has
 * an administrator at all, and whether this browser is one.
 */
export const sessionQueryOptions = () => $api.queryOptions('get', '/auth/session');

// Derived from the query options rather than written out, like admin-queries.ts.
export const sessionKey = () => sessionQueryOptions().queryKey;

/**
 * Only a router path is ever accepted back, never an arbitrary URL: the return-to-where-you-
 * were behaviour is otherwise an open redirect. `//host` is protocol-relative, so it has to
 * be excluded separately from a leading slash.
 */
export function internalPath(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (!value.startsWith('/') || value.startsWith('//')) return undefined;
  return value;
}
