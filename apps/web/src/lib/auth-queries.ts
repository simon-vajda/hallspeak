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
 * were behaviour is otherwise an open redirect. Canonicalized rather than pattern-matched,
 * because the shapes a browser reads as a host outnumber the ones worth enumerating —
 * `//evil.example` is protocol-relative and `/\evil.example` is the same thing with the
 * slash the URL parser normalizes for you.
 */
// A sentinel rather than window.location.origin: the answer does not depend on which host
// the page is on, and reading `window` would make this helper untestable under the web
// suite's no-jsdom rule.
const SENTINEL_ORIGIN = 'http://internal.invalid';

export function internalPath(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.startsWith('/')) {
    return undefined;
  }

  try {
    const url = new URL(value, SENTINEL_ORIGIN);
    // Anything that resolved to another origin was a host in disguise.
    if (url.origin !== SENTINEL_ORIGIN) {
      return undefined;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return undefined;
  }
}
