import type { ChannelBroadcast } from '@/lib/format';
import { plural } from '@/lib/format';

/**
 * Whether an action is about to take a broadcast down, and what to say about it. Every caller
 * treats `undefined` as silence, which is what a withheld poll gets: a dead poll is not a live
 * reading, so a warning built on it would assert something the page cannot know. A disabled
 * event or channel is silent too — no guest can be on it, so a producer left over from before
 * it was switched off is not an audience.
 */
const CHANNEL_WARNING = 'An interpreter is on air on this channel right now.';

export function channelLiveWarning(channel: {
  enabled: boolean;
  broadcast: ChannelBroadcast;
}): string | undefined {
  if (!channel.enabled || channel.broadcast.state !== 'on-air') {
    return undefined;
  }

  return CHANNEL_WARNING;
}

export function eventLiveWarning(event: {
  enabled: boolean;
  onAir: number;
  liveKnown: boolean;
}): string | undefined {
  if (!event.enabled || !event.liveKnown || event.onAir === 0) {
    return undefined;
  }

  return `${plural(event.onAir, 'channel')} of this event ${event.onAir === 1 ? 'is' : 'are'} on air right now.`;
}

/** The unknown case is its own sentence: it reports the gap, never a guess about the channel. */
export const LIVENESS_UNKNOWN = 'Whether anyone is on air right now could not be checked.';

export interface DisableNotice {
  tone: 'live' | 'unknown';
  message: string;
}

/**
 * What switching something off has to say before it runs, or null when it may run unasked.
 *
 * A confirmed-live target warns. A target whose liveness the poll cannot report warns that it
 * cannot report it: treating an unknown channel as idle is the same mistake as printing
 * `Nobody on air` under a dead poll, and the row already shows a dash beside this switch. An
 * idle channel under a healthy poll asks nothing, so the common path stays one press.
 */
export function disableConfirmation(input: {
  warning: string | undefined;
  liveKnown: boolean;
}): DisableNotice | null {
  if (input.warning) {
    return { tone: 'live', message: input.warning };
  }
  if (!input.liveKnown) {
    return { tone: 'unknown', message: LIVENESS_UNKNOWN };
  }

  return null;
}
