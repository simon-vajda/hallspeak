/** The design prints a PIN grouped 3+3; the wire never carries the space. */
export function formatPin(pin: string) {
  return `${pin.slice(0, 3)} ${pin.slice(3)}`;
}

/**
 * A running duration as `M:SS`, growing to `H:MM:SS` past an hour. Negative spans read as zero:
 * callers pass `Date.now() - startedAt`, which a clock adjustment can briefly push below it.
 */
export function formatElapsed(ms: number) {
  const total = Math.floor(Math.max(ms, 0) / 1000);
  const seconds = String(total % 60).padStart(2, '0');
  const hours = Math.floor(total / 3600);
  if (hours === 0) {
    return `${Math.floor(total / 60)}:${seconds}`;
  }

  return `${hours}:${String(Math.floor(total / 60) % 60).padStart(2, '0')}:${seconds}`;
}

/** `1 channel` / `2 channels`, for copy that counts something. */
export function plural(n: number, noun: string) {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

/** The dash is the whole message when the poll cannot answer; a screen reader needs the words. */
export const STATUS_UNKNOWN = 'Status unknown';

const WITHHELD = { label: '\u2014', withheld: true } as const;

/**
 * The admin status column: enablement while there is nothing to be live about, liveness once
 * there is. `onAir` is how many of the event's channels have an interpreter producing; an event
 * absent from the live payload has none, which is a count of zero rather than a missing answer.
 *
 * `liveKnown` is false while the live poll is pending or failing. Configuration outranks it —
 * a disabled or empty event is a fact the poll has no bearing on — but no live reading is
 * printed without one, because an empty index and a quiet room look identical.
 */
export function eventStatusLabel(event: {
  enabled: boolean;
  channels: number;
  onAir: number;
  liveKnown: boolean;
}): { label: string; withheld: boolean } {
  if (!event.enabled) {
    return { label: 'Disabled', withheld: false };
  }
  if (event.channels === 0) {
    return { label: 'No channels yet', withheld: false };
  }
  if (!event.liveKnown) {
    return WITHHELD;
  }
  if (event.onAir === 0) {
    return { label: 'Nobody on air', withheld: false };
  }

  return { label: `${event.onAir} on air`, withheld: false };
}

/**
 * A channel's broadcast axis, kept apart from its audience: the badge renders the state and the
 * count is its own line, so neither redraws to say the other changed. `undefined` is a channel
 * the live payload does not mention, which is idle — but only once the payload can be believed.
 */
export type ChannelBroadcast =
  | { state: 'withheld' }
  | { state: 'offline' }
  | { state: 'on-air'; listeners: number };

export function channelBroadcast(
  live: { online: boolean; listeners: number } | undefined,
  liveKnown: boolean,
): ChannelBroadcast {
  if (!liveKnown) {
    return { state: 'withheld' };
  }
  if (!live?.online) {
    return { state: 'offline' };
  }

  return { state: 'on-air', listeners: live.listeners };
}
