/**
 * The pure half of the input meter: byte-domain frames in, a 0–1 level and a status out.
 * Kept apart from the component so the "has the mic read anything?" gate on Go live can
 * reuse the same numbers the meter draws.
 */

/** Above this the fill goes `destructive` and the tick is where the design marks it. */
export const PEAK_THRESHOLD = 0.85;

/** Below this the mic is reading room noise at most — not enough to go live on. */
export const SILENCE_THRESHOLD = 0.05;

export type LevelStatus = 'quiet' | 'good' | 'peaking';

/**
 * RMS of an `AnalyserNode` time-domain byte frame, normalised to 0–1. Bytes are centred
 * on 128, so a frame of all-128 is digital silence and reads exactly 0.
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
