import { PIN_PATTERN, SLUG_PATTERN } from '@hallspeak/contract/patterns';
import type { Href } from 'expo-router';
import { apiOrigin } from '@/api/client';
import { isListenerHost } from './host';
import type { ListenerDestination } from './parse';

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

/**
 * Typed routes cannot express a path built at runtime, and the alternative — pathname plus
 * params at every call site — would leave the builders above with no caller and the dotted
 * host untested. The cast is confined to the four builders below.
 */
export function eventHref(host: string, pin: string): Href {
  return buildEventPath(host, pin) as Href;
}

export function channelHref(host: string, pin: string, slug: string): Href {
  return buildChannelPath(host, pin, slug) as Href;
}

export function reportSheetHref(host: string, pin: string, slug: string): Href {
  return `${buildChannelPath(host, pin, slug)}/report` as Href;
}

type RouteSegment = string | string[] | undefined;

export type EventParams = { host: string; pin: string };
export type ChannelParams = EventParams & { slug: string };

function firstSegment(segment: RouteSegment): string {
  const raw = Array.isArray(segment) ? segment[0] : segment;

  return raw === undefined ? '' : raw;
}

/**
 * The app registers a URL scheme, so these params arrive from outside it as well as from the
 * link parser, and the parser's checks are no longer the only way in. Null is what keeps an
 * unvalidated host out of `apiBaseUrl`, which interpolates the whole value into an origin.
 */
export function readEventParams(host: RouteSegment, pin: RouteSegment): EventParams | null {
  const readHost = firstSegment(host).toLowerCase();
  const readPin = firstSegment(pin);

  if (!isListenerHost(readHost) || !PIN_PATTERN.test(readPin)) {
    return null;
  }

  return { host: readHost, pin: readPin };
}

export function readChannelParams(
  host: RouteSegment,
  pin: RouteSegment,
  slug: RouteSegment,
): ChannelParams | null {
  const event = readEventParams(host, pin);
  const readSlug = firstSegment(slug);

  if (event === null || !SLUG_PATTERN.test(readSlug)) {
    return null;
  }

  return { ...event, slug: readSlug };
}

export type SpeakerLinkParams = ChannelParams & { code: string };

/**
 * The sheet is addressed by the link's validated parts, never by a URL: the registered scheme
 * lets any page open this route, and a URL parameter would let it choose what the browser opens.
 *
 * The names must differ from the event route's `host`, `pin` and `slug` segments. When they
 * matched, replacing the sheet with the channel landed on a parameterless Event screen.
 */
export function speakerLinkHref({ host, pin, slug, code }: SpeakerLinkParams): Href {
  const query = new URLSearchParams({ server: host, eventPin: pin, channel: slug, code });

  return `/speaker-link?${query.toString()}` as Href;
}

export function readSpeakerLinkParams(
  host: RouteSegment,
  pin: RouteSegment,
  slug: RouteSegment,
  code: RouteSegment,
): SpeakerLinkParams | null {
  const channel = readChannelParams(host, pin, slug);
  const readCode = firstSegment(code);

  if (channel === null || readCode === '') {
    return null;
  }

  return { ...channel, code: readCode };
}

export function speakerStudioUrl({ host, pin, slug, code }: SpeakerLinkParams): string {
  return `${apiOrigin(host)}/events/${pin}/${slug}?speaker_code=${encodeURIComponent(code)}`;
}

/** Like the speaker-link sheet, addressed under names the event route's segments do not use. */
export function shareEventHref({ host, pin }: EventParams): Href {
  const query = new URLSearchParams({ server: host, eventPin: pin });

  return `/share-event?${query.toString()}` as Href;
}

/** The event, never a channel: a newcomer who scans it picks their own language. */
export function eventListenerUrl(host: string, pin: string): string {
  return `${apiOrigin(host)}/events/${pin}`;
}

export function destinationHref(
  destination: ListenerDestination,
  speakerCode: string | null,
): Href {
  const { host, pin, slug } = destination;

  if (slug === null) {
    return eventHref(host, pin);
  }

  return speakerCode === null
    ? channelHref(host, pin, slug)
    : speakerLinkHref({ host, pin, slug, code: speakerCode });
}
