import { apiProblemCode } from '@/lib/query-retry';

/**
 * On-air is a reading taken when the fetch answered, and frozen after. Nothing on this
 * screen updates itself, so `unknown` is a real state rather than a loading detail: before a
 * reading exists the row withholds instead of printing the negative, because an unknown
 * reading is not an offline one.
 */
export type ChannelReading = 'on-air' | 'offline' | 'unknown';

export function channelReading(online: boolean | undefined, known: boolean): ChannelReading {
  if (!known || online === undefined) {
    return 'unknown';
  }

  return online ? 'on-air' : 'offline';
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
    body: 'Check the link or the code at your venue, then pull down to try again.',
  };
}

/** The web app's "it updates on its own" line would be a false promise without a socket. */
export const EVENT_REFRESH_NOTE =
  'Channel status was read when this screen loaded. Pull down to read it again.';

export const NO_CHANNELS_TITLE = 'No channels yet';
export const NO_CHANNELS_BODY =
  'This event has no channels to listen to. Pull down once the organiser adds one.';

export const CHOOSE_A_CHANNEL = 'Choose a channel';
