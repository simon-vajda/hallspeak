/**
 * Every string the Channel screen can render, keyed by the state that produces it. Copy lives
 * here rather than at the call sites so the rule that nothing may claim audio is reaching a
 * listener is checkable by enumerating states, instead of by reading four regions of JSX.
 */
export type ChannelState = 'on-air' | 'offline' | 'missing' | 'unreachable';

export const CHANNEL_STATES = [
  'on-air',
  'offline',
  'missing',
  'unreachable',
] as const satisfies readonly ChannelState[];

export type ListenTargetCopy = {
  label: string;
  /**
   * There is no media path behind the target yet, so it is reported inert rather than styled
   * inert: a screen cannot decide on its own that the control it draws does something.
   */
  enabled: false;
};

export type ChannelActionsCopy = {
  route: string;
  report: string;
};

export type ChannelCopy = {
  /** Present only while the channel is on air; nothing stands in for it when it is not. */
  badge?: string;
  /** Present only where there is no channel to act on, and it names no cause. */
  title?: string;
  /** Absent alongside `title`: a channel that did not resolve has no control to offer. */
  target?: ListenTargetCopy;
  actions?: ChannelActionsCopy;
  note: string;
};

export const PENDING_NOTE = 'Looking for this channel.';
export const BACK_LABEL = 'Go back';
export const RETRY_LABEL = 'Try again';

/** The one thing this build cannot do, said once and reused, so no state invents its own wording. */
const NO_AUDIO_YET = 'Audio arrives in a later version of this app.';

const TARGET: ListenTargetCopy = { label: 'Audio unavailable', enabled: false };

/** The design's order: the route control first, the report action second. */
const ACTIONS: ChannelActionsCopy = { route: 'Audio', report: 'Report a problem' };

/**
 * Names no cause and repeats no PIN: a missing channel, a disabled one and a wrong slug are
 * one 404 at the server, and this screen must not undo that parity by wording them apart.
 */
const MISSING = {
  title: 'That channel is not available',
  note: 'Check the link, or scan the code at your venue again.',
} as const;

const UNREACHABLE = {
  title: "Couldn't load this channel",
  note: 'Try again in a moment.',
} as const;

/**
 * `elapsed` is the only figure on this screen without a real source; it is passed in rather
 * than reached for, so the placeholder is visible at the call site that supplies it.
 */
export function channelCopy(state: ChannelState, elapsed?: string): ChannelCopy {
  switch (state) {
    case 'on-air':
      return {
        badge: 'On air',
        target: TARGET,
        actions: ACTIONS,
        note:
          elapsed === undefined
            ? NO_AUDIO_YET
            : `The interpreter has been ${elapsed}. ${NO_AUDIO_YET}`,
      };
    case 'offline':
      return {
        target: TARGET,
        actions: ACTIONS,
        note: `This channel turns on when its interpreter connects. ${NO_AUDIO_YET}`,
      };
    case 'missing':
      return MISSING;
    case 'unreachable':
      return UNREACHABLE;
  }
}
