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
  if (hours === 0) return `${Math.floor(total / 60)}:${seconds}`;

  return `${hours}:${String(Math.floor(total / 60) % 60).padStart(2, '0')}:${seconds}`;
}

/** `1 channel` / `2 channels`, for copy that counts something. */
export function plural(n: number, noun: string) {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

/**
 * The admin status column: enablement while there is nothing to be live about, liveness once
 * there is. `onAir` is how many of the event's channels have an interpreter producing; an event
 * absent from the live payload has none, which is a count of zero rather than a missing answer.
 */
export function eventStatusLabel(event: { enabled: boolean; channels: number; onAir: number }) {
  if (!event.enabled) return 'Disabled';
  if (event.channels === 0) return 'No channels yet';
  if (event.onAir === 0) return 'Nobody on air';

  return `${event.onAir} on air`;
}

/**
 * A channel's live line. `undefined` is a channel the live payload does not mention: idle.
 * `listening` is a participle, so it counts without agreeing — no pluralisation to get wrong.
 */
export function channelLiveLabel(live: { online: boolean; listeners: number } | undefined) {
  if (!live?.online) return 'Nobody on air';

  return `On air · ${live.listeners} listening`;
}
