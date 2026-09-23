import {
  badgeLabel,
  type ListenActionState,
  type ListenBadgeInput,
  type ListenNoteInput,
  playTargetLabel,
  statusNote,
} from '@hallspeak/client-core/channel';

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

/**
 * The channel has not been read yet. Neither label, rather than the negative one, and no note:
 * a failed read settles into the screen's own error, so this state is only ever loading.
 */
export const LOADING_BADGE = 'Loading channel';

export const OFFLINE_NOTE = 'This channel will update as soon as a speaker goes on air.';
export const READY_NOTE = 'Press play to start listening.';

export function channelCopy(input: (ListenBadgeInput & ListenNoteInput) | 'unknown'): ChannelCopy {
  if (input === 'unknown') {
    return { badge: null, accessibleBadge: LOADING_BADGE, note: null };
  }

  const badge = badgeLabel(input);

  let note = statusNote(input);
  if (input.linkConnected && !input.holding) {
    if (!input.live) {
      note = OFFLINE_NOTE;
    } else if (!input.isPlaying) {
      note = READY_NOTE;
    }
  }

  return { badge, accessibleBadge: badge, note };
}

/** The target while the channel has not been read: in place, and not yet pressable. */
export const LOADING_TARGET_LABEL = 'Listen, loading channel';

/** The word for a target that is playing. Every other state's word is the shared state's. */
export const STOP_LABEL = 'Stop listening';

/** Offered when the recovery ladder has given up: only a fresh session can help now. */
export const TRY_AGAIN_LABEL = 'Try again';

/** Names the line for a screen reader; the line's own text is the route and the level. */
export const AUDIO_ACTION_LABEL = 'Audio output';
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
  LOADING_TARGET_LABEL,
  STOP_LABEL,
  TRY_AGAIN_LABEL,
  AUDIO_ACTION_LABEL,
  REPORT_ACTION_LABEL,
];
