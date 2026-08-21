/**
 * The pure half of the input meter, kept apart from the component so the "has the mic read
 * anything?" gate on Go live reuses the same numbers the meter draws.
 */

/** Above this the fill goes `destructive`, and the design draws its tick here. */
export const PEAK_THRESHOLD = 0.85;

/** Below this the mic is reading room noise at most, not enough to go live on. */
export const SILENCE_THRESHOLD = 0.05;

export type LevelStatus = 'quiet' | 'good' | 'peaking';

/**
 * RMS of an `AnalyserNode` time-domain byte frame, normalised to 0–1. Bytes are centred on
 * 128, so a frame of all-128 is digital silence and reads exactly 0.
 */
export function rms(frame: Uint8Array): number {
  if (frame.length === 0) return 0;

  let sum = 0;
  for (const byte of frame) {
    const sample = (byte - 128) / 128;
    sum += sample * sample;
  }
  return Math.sqrt(sum / frame.length);
}

/** The threshold is inclusive so the colour change agrees with the tick drawn at it. */
export function levelStatus(level: number): LevelStatus {
  if (level >= PEAK_THRESHOLD) return 'peaking';
  return level < SILENCE_THRESHOLD ? 'quiet' : 'good';
}

/**
 * The one-pole time constants the meter's motion is built from. Attack is short enough that a
 * syllable still reads as an attack; release is long enough that the bar does not strobe in the
 * gaps between them. Both are time constants, not durations: a step covers ~63% of the distance
 * in one tau.
 */
export const ATTACK_MS = 60;
export const RELEASE_MS = 280;

/** The clip marker's own fall, slow enough that a plosive is still on screen when read. */
export const HOLD_DECAY_MS = 900;

/**
 * One frame of the displayed level. Driven by elapsed time rather than a per-frame fraction, so
 * a 30Hz display and a coalesced frame decay by the same amount as a 60Hz one. The first frame
 * has no elapsed time to integrate over and simply adopts the target.
 */
export function smoothLevel(previous: number, target: number, elapsedMs: number): number {
  if (!(elapsedMs > 0)) return target;

  const tau = target > previous ? ATTACK_MS : RELEASE_MS;
  return previous + (target - previous) * (1 - Math.exp(-elapsedMs / tau));
}

/**
 * The clip indicator's peak-hold: it takes a rise instantly and only the fall is smoothed. The
 * fill cannot drive the indicator, because the attack that makes the bar readable also swallows
 * the 10–50ms bursts the indicator exists to catch.
 */
export function holdPeak(previous: number, level: number, elapsedMs: number): number {
  if (!(elapsedMs > 0) || level >= previous) return level;

  return level + (previous - level) * Math.exp(-elapsedMs / HOLD_DECAY_MS);
}
