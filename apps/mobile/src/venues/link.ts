import { PIN_PATTERN } from '@linguacast/contract/patterns';
import type { ParsedListenerLink } from './types';

const URL_PATTERN = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/([^/?#]*)([^?#]*)/;
const HOST_PATTERN = /^(?:[a-z0-9.-]+|\[[0-9a-f:.]+\])(?::\d{1,5})?$/;

/**
 * Turns a scanned or pasted string into a host and a PIN. Anything that is not `https:` is
 * refused, which is what lets the scheme be a constant everywhere else.
 *
 * Parsed by hand rather than through `URL`: React Native's polyfill does not expose the
 * host and port fields this depends on.
 */
export function parseListenerLink(input: string): ParsedListenerLink {
  const trimmed = input.trim();
  if (trimmed === '') {
    return { ok: false, reason: 'empty' };
  }

  const match = URL_PATTERN.exec(trimmed);
  if (!match) {
    return { ok: false, reason: 'not_a_link' };
  }

  const [, scheme, authority, path] = match;
  if (scheme?.toLowerCase() !== 'https') {
    return { ok: false, reason: 'insecure_scheme' };
  }

  const host = (authority ?? '').toLowerCase();
  if (!HOST_PATTERN.test(host)) {
    return { ok: false, reason: 'not_a_link' };
  }

  const segments = (path ?? '').split('/').filter((segment) => segment !== '');
  const eventsAt = segments.indexOf('events');
  const pin = eventsAt === -1 ? undefined : segments[eventsAt + 1];
  if (pin === undefined) {
    return { ok: false, reason: 'missing_pin' };
  }
  if (!PIN_PATTERN.test(pin)) {
    return { ok: false, reason: 'invalid_pin' };
  }

  return { ok: true, venue: { host, pin } };
}
