/**
 * Routes are addressed by host and PIN rather than by a stored history id: a scanned code
 * reaches the Event screen before anything is remembered, so opening an event cannot depend
 * on the history list.
 *
 * A bare host is one path segment by construction. An origin would have been three, because
 * of its `://` — which is the whole reason the route carries a host and not a URL.
 */
export type EventPath = `/events/${string}/${string}`;

export function buildEventPath(host: string, pin: string): EventPath {
  return `/events/${encodeHostSegment(host)}/${pin}`;
}

export function buildChannelPath(host: string, pin: string, slug: string): string {
  return `${buildEventPath(host, pin)}/${slug}`;
}

/**
 * Nothing in Expo Router reserves a `.` in a dynamic segment, and a dotted host round-trips
 * as itself. The pair exists anyway so the encoding lives in one place: if a router version
 * ever does reserve one, this is the only file that changes.
 */
export function encodeHostSegment(host: string): string {
  return host;
}

export function readHostSegment(segment: string | string[] | undefined): string {
  const raw = Array.isArray(segment) ? segment[0] : segment;

  return raw === undefined ? '' : raw;
}
