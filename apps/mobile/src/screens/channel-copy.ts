import type { ChannelReading } from './event-view';

/**
 * Every string the Channel screen can render, keyed by the state that produces it. The point
 * is the test beside this file: it enumerates these states against a forbidden-claim list, so
 * "no copy claims anybody is hearing audio" is enforced mechanically rather than by review.
 *
 * The design's "has been on air for N minutes" sentence is deliberately absent. The public
 * payload carries an on-air flag and not the time a broadcast started, so that sentence is a
 * claim this run cannot make.
 */
export type ChannelCopy = {
  badge: string | null;
  accessibleBadge: string;
  note: string;
};

const COPY: Record<ChannelReading, ChannelCopy> = {
  'on-air': {
    badge: 'On air',
    accessibleBadge: 'On air',
    note: 'Headphones recommended, so the room stays quiet for everyone else.',
  },
  offline: {
    badge: 'Offline',
    accessibleBadge: 'Offline',
    // Names that nobody is broadcasting without implying the screen would notice a change.
    note: 'Nobody is broadcasting on this channel. Pull down to check again.',
  },
  unknown: {
    // Withheld rather than negative: the badge's slot stays, its label does not.
    badge: null,
    accessibleBadge: 'Status unknown',
    note: 'This channel could not be read. Pull down to try again.',
  },
};

export function channelCopy(reading: ChannelReading): ChannelCopy {
  return COPY[reading];
}

export const LISTEN_LABEL = 'Listen';
export const STOP_LABEL = 'Stop listening';

/**
 * The target answers a press in this run but no audio path exists behind it, so the note
 * stays and stays literal: pressing Listen is an intent, not a stream.
 */
export const LISTEN_UNAVAILABLE_NOTE = 'Listening is not available in this version.';

export const AUDIO_ACTION_LABEL = 'Audio';
export const AUDIO_ACTION_DETAIL = 'System output · 80%';
export const REPORT_ACTION_LABEL = 'Report a problem';

/** Everything above, flattened, so the test cannot miss a string by forgetting to list it. */
export const ALL_CHANNEL_COPY: string[] = [
  ...Object.values(COPY).flatMap(({ badge, accessibleBadge, note }) =>
    [badge, accessibleBadge, note].filter((value): value is string => value !== null),
  ),
  LISTEN_LABEL,
  STOP_LABEL,
  LISTEN_UNAVAILABLE_NOTE,
  AUDIO_ACTION_LABEL,
  AUDIO_ACTION_DETAIL,
  REPORT_ACTION_LABEL,
];
