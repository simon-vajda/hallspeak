import { apiProblemCode } from '@hallspeak/client-core/query-retry';
import type { ServerCheck } from '@/socket/server-check';

/**
 * On-air is what the socket last said, seeded by the fetch until it speaks. `unknown` is a
 * real state rather than a loading detail: before a reading exists the row withholds instead
 * of printing the negative, because an unknown reading is not an offline one — and a socket
 * that dropped keeps what it last said rather than falling back to offline.
 */
export type ChannelReading = 'on-air' | 'offline' | 'unknown';

export function channelReading(online: boolean | undefined, known: boolean): ChannelReading {
  if (!known || online === undefined) {
    return 'unknown';
  }

  return online ? 'on-air' : 'offline';
}

/**
 * The reading for a channel the socket may already have spoken about. A status present is a
 * status read, whether it came from the socket or seeded the socket from the fetch; absent
 * is the withheld case, which includes a fetch that has not landed.
 */
export function channelReadingFor(status: { online: boolean } | undefined): ChannelReading {
  if (status === undefined) {
    return 'unknown';
  }

  return status.online ? 'on-air' : 'offline';
}

/** Null is the withheld case: the badge's slot stays, so a data change is not a re-layout. */
export function channelReadingLabel(reading: ChannelReading): string | null {
  if (reading === 'unknown') {
    return null;
  }

  return reading === 'on-air' ? 'On air' : 'Offline';
}

export function channelReadingAccessibleLabel(reading: ChannelReading): string {
  return channelReadingLabel(reading) ?? 'Status unknown';
}

export type EventErrorMessage = { title: string; body: string };

/**
 * A disabled event, an unknown PIN and a server that never answered are one message. The
 * first two are byte-identical 404s by the server's own rule, and React Native reports an
 * untrusted certificate and an unreachable host identically — so a screen that named a cause
 * would be inventing a distinction the API deliberately withholds.
 */
export function eventErrorMessage(error: unknown): EventErrorMessage {
  if (apiProblemCode(error) === 'rate_limited') {
    return {
      title: 'Too many tries',
      body: 'Wait a moment before opening another event.',
    };
  }

  return {
    title: 'This event could not be opened',
    body: 'Check the link or the code at your venue, then open the event again.',
  };
}

/**
 * Refused before any request, so this one does name its cause: the address itself is not an
 * event, which is a thing the guest can see and fix.
 */
export const BAD_ROUTE_MESSAGE: EventErrorMessage = {
  title: 'This link is not a Hallspeak event',
  body: 'Check the link, or scan the code at your venue again.',
};

export const EVENT_REFRESH_NOTE = 'Channels turn on when their interpreter connects.';

export const NO_CHANNELS_TITLE = 'No channels yet';
export const NO_CHANNELS_BODY =
  'This event has no channels to listen to yet. Open it again once the organiser adds one.';

export const CHOOSE_A_CHANNEL = 'Choose a channel';

export type EventScreenState = 'bad-route' | 'blocked' | 'error' | 'loading' | 'ready';

/**
 * Failure copy waits for a read that settled as failed. While the version check or the event
 * request is still in flight — retries included — the screen is loading, not failing; and a
 * refetch that fails over an event already on screen leaves that event showing.
 */
export function eventScreenState(input: {
  routeValid: boolean;
  gate: ServerCheck['state'];
  isError: boolean;
  hasEvent: boolean;
}): EventScreenState {
  if (!input.routeValid) {
    return 'bad-route';
  }

  if (input.gate === 'blocked') {
    return 'blocked';
  }

  if (input.hasEvent) {
    return 'ready';
  }

  return input.isError ? 'error' : 'loading';
}

/** The one line a screen reader hears for the whole skeleton, rather than a list of blanks. */
export const LOADING_EVENT = 'Loading event';
