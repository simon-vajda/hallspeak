import { PIN_PATTERN, SLUG_PATTERN } from '@hallspeak/contract/patterns';
import { isListenerHost } from './host';

export type ListenerDestination = {
  host: string;
  pin: string;
  /** Null when the link names an event rather than one of its channels. */
  slug: string | null;
};

export type LinkRefusalReason =
  | 'not-a-url'
  | 'insecure-scheme'
  | 'unknown-host'
  | 'wrong-path'
  | 'bad-pin'
  | 'bad-slug';

export type ParsedListenerLink =
  | {
      ok: true;
      destination: ListenerDestination;
      /** Null unless the link names a channel and carries a non-empty `speaker_code`. */
      speakerCode: string | null;
    }
  | { ok: false; reason: LinkRefusalReason };

const refuse = (reason: LinkRefusalReason): ParsedListenerLink => ({ ok: false, reason });

/**
 * Turns a pasted or scanned string into a destination or a named refusal, with no request of
 * any kind. Two reasons for the locality: a listener is told what is wrong with the link
 * rather than watching a request fail, and the server's public lookups are metered per
 * address — a room of guests shares one NAT, so a malformed link must not spend a token.
 *
 * A `speaker_code` is reported so the link can be handed to the browser, which hosts the
 * speaker studio. The app never sends it anywhere: this is a listener client, and honouring the
 * code here would make possession of a scanned link a broadcasting capability inside the app.
 */
export function parseListenerLink(input: string): ParsedListenerLink {
  const trimmed = input.trim();

  if (trimmed === '' || /\s/.test(trimmed)) {
    return refuse('not-a-url');
  }

  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//.exec(trimmed);

  if (!scheme) {
    return refuse('not-a-url');
  }

  if (scheme[1]?.toLowerCase() !== 'https') {
    return refuse('insecure-scheme');
  }

  const rest = trimmed.slice(scheme[0].length);
  const authority = rest.split(/[/?#]/, 1)[0] ?? '';
  const host = authority.toLowerCase();

  if (!isListenerHost(host)) {
    return refuse('unknown-host');
  }

  const afterAuthority = rest.slice(authority.length).split('#', 1)[0] ?? '';
  const queryStart = afterAuthority.indexOf('?');
  const path = queryStart === -1 ? afterAuthority : afterAuthority.slice(0, queryStart);
  const segments = path.split('/').filter((segment) => segment !== '');

  if (segments[0] !== 'events' || segments.length < 2 || segments.length > 3) {
    return refuse('wrong-path');
  }

  const pin = segments[1] ?? '';

  if (!PIN_PATTERN.test(pin)) {
    return refuse('bad-pin');
  }

  const slug = segments[2];

  if (slug === undefined) {
    return { ok: true, destination: { host, pin, slug: null }, speakerCode: null };
  }

  if (!SLUG_PATTERN.test(slug)) {
    return refuse('bad-slug');
  }

  const query = queryStart === -1 ? '' : afterAuthority.slice(queryStart + 1);
  const speakerCode = new URLSearchParams(query).get('speaker_code') || null;

  return { ok: true, destination: { host, pin, slug }, speakerCode };
}
