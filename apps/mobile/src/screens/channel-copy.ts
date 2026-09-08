import {
  badgeLabel,
  type ListenActionState,
  type ListenBadgeInput,
  type ListenNoteInput,
  playTargetLabel,
  statusNote,
} from '@linguacast/client-core/channel';

/**
 * Every string the Channel screen can render. The point is the test beside this file: it
 * enumerates them against a forbidden-claim list, so "no copy claims anybody is hearing
 * audio unless a consumer is open" is enforced mechanically rather than by review.
 *
 * The badge and the note come from the shared listen state rather than a table of their
 * own, so the enumeration below is *derived* from every input those two functions accept.
 * A state added there cannot slip past this file by being forgotten in a list.
 *
 * The design's "has been on air for N minutes" sentence is deliberately absent. The public
 * payload carries an on-air flag and not the time a broadcast started, so that sentence is
 * a claim this app cannot make.
 */
export type ChannelCopy = {
  /** Null is the withheld case: the badge's slot stays, its label does not. */
  badge: string | null;
  accessibleBadge: string;
  note: string | null;
};

/** A reading nobody has taken. Neither label, rather than the negative one. */
export const UNKNOWN_BADGE = 'Status unknown';

export function channelCopy(input: (ListenBadgeInput & ListenNoteInput) | 'unknown'): ChannelCopy {
  if (input === 'unknown') {
    return { badge: null, accessibleBadge: UNKNOWN_BADGE, note: UNKNOWN_NOTE };
  }

  const badge = badgeLabel(input);

  return { badge, accessibleBadge: badge, note: statusNote(input) };
}

export const UNKNOWN_NOTE = 'This channel could not be read. Pull down to try again.';

export const LISTEN_LABEL = 'Listen';
export const STOP_LABEL = 'Stop listening';

/** Offered when the recovery ladder has given up: only a fresh session can help now. */
export const TRY_AGAIN_LABEL = 'Try again';

export const AUDIO_ACTION_LABEL = 'Audio';
export const REPORT_ACTION_LABEL = 'Report a problem';

/** The target's own label follows the shared action state, not the press. */
export function targetLabel(state: ListenActionState): string {
  return state === 'playing' ? STOP_LABEL : playTargetLabel(state);
}

const BOOLEANS = [true, false];
const MUTES: (boolean | null)[] = [true, false, null];
const REASONS: (ListenNoteInput['closeReason'] | undefined)[] = ['ended', 'dropped', undefined];

/** Every badge and note the shared state can produce, so the test cannot miss one. */
function everyState(): ChannelCopy[] {
  const all: ChannelCopy[] = [channelCopy('unknown')];

  for (const live of BOOLEANS) {
    for (const muted of MUTES) {
      for (const holding of BOOLEANS) {
        for (const linkConnected of BOOLEANS) {
          for (const isPlaying of BOOLEANS) {
            for (const closeReason of REASONS) {
              all.push(
                channelCopy({
                  live,
                  muted,
                  holding,
                  linkConnected,
                  isPlaying,
                  ...(closeReason === undefined ? {} : { closeReason }),
                }),
              );
            }
          }
        }
      }
    }
  }

  return all;
}

const ACTION_STATES: ListenActionState[] = ['unavailable', 'ready', 'playing', 'holding'];

/** Everything above, flattened, so the test cannot miss a string by forgetting to list it. */
export const ALL_CHANNEL_COPY: string[] = [
  ...everyState().flatMap(({ badge, accessibleBadge, note }) =>
    [badge, accessibleBadge, note].filter((value): value is string => value !== null),
  ),
  ...ACTION_STATES.map(targetLabel),
  LISTEN_LABEL,
  STOP_LABEL,
  TRY_AGAIN_LABEL,
  AUDIO_ACTION_LABEL,
  REPORT_ACTION_LABEL,
];
