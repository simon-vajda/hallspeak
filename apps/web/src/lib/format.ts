/** The design prints a PIN grouped 3+3; the wire never carries the space. */
export function formatPin(pin: string) {
  return `${pin.slice(0, 3)} ${pin.slice(3)}`;
}

/**
 * A running duration as `M:SS`, growing an hour field to `H:MM:SS` once it passes an hour —
 * the design's on-air clock. Only the fields to the right of the leading one are padded, so
 * the number never gains a meaningless zero. Negative spans read as zero: the caller's input
 * is `Date.now() - startedAt`, which a clock adjustment can briefly push below it.
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
