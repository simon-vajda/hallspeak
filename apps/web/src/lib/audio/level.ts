/**
 * The pure half of the input meter, kept apart from the component so the "has the mic read
 * anything?" gate on Go live reuses the same numbers the meter draws.
 */

/**
 * The meter's floor. Everything the bar draws is a position on a decibel scale running from
 * here to full scale, not a raw amplitude: speech that sounds loud in the room is an RMS
 * around 0.1, which on a linear bar never leaves the left tenth of the track.
 */
export const METER_FLOOR_DB = -60;

/** Above this the fill goes `destructive`, and the design draws its tick here. */
export const PEAK_THRESHOLD = 0.85;

/** Below this the mic is reading room noise at most, not enough to go live on. */
export const SILENCE_THRESHOLD = 0.25;

export type LevelStatus = 'quiet' | 'good' | 'peaking';

/**
 * An RMS amplitude as a position on the meter, 0 at `METER_FLOOR_DB` and 1 at full scale.
 * Perceived loudness is logarithmic, so this is what makes a rise the interpreter can hear a
 * rise they can also see; the thresholds and the design's tick are positions on this scale.
 */
export function meterLevel(amplitude: number): number {
  if (!(amplitude > 0)) {
    return 0;
  }

  const db = 20 * Math.log10(amplitude);
  return Math.min(Math.max((db - METER_FLOOR_DB) / -METER_FLOOR_DB, 0), 1);
}

/**
 * RMS of an `AnalyserNode` time-domain frame, 0 for digital silence and 1 for full scale.
 *
 * The frame must be float, not `getByteTimeDomainData`'s bytes: one 8-bit step is 1/128, about
 * -42 dBFS, so a byte frame cannot represent a quiet room at all and pins the meter near a
 * quarter of the track no matter what the microphone is doing.
 */
export function rms(frame: Float32Array): number {
  if (frame.length === 0) {
    return 0;
  }

  let sum = 0;
  for (const sample of frame) {
    sum += sample * sample;
  }
  return Math.sqrt(sum / frame.length);
}

/** The threshold is inclusive so the colour change agrees with the tick drawn at it. */
export function levelStatus(level: number): LevelStatus {
  if (level >= PEAK_THRESHOLD) {
    return 'peaking';
  }
  return level < SILENCE_THRESHOLD ? 'quiet' : 'good';
}

/**
 * The one-pole time constants the meter's motion is built from. Attack is short enough that a
 * syllable still reads as an attack; release is long enough that the bar does not strobe in the
 * gaps between them. Both are time constants, not durations: a step covers ~63% of the distance
 * in one tau.
 */
export const ATTACK_MS = 20;
export const RELEASE_MS = 280;

/** The clip marker's own fall, slow enough that a plosive is still on screen when read. */
export const HOLD_DECAY_MS = 900;

/**
 * One frame of the displayed level. Driven by elapsed time rather than a per-frame fraction, so
 * a 30Hz display and a coalesced frame decay by the same amount as a 60Hz one. The first frame
 * has no elapsed time to integrate over and simply adopts the target.
 */
export function smoothLevel(previous: number, target: number, elapsedMs: number): number {
  if (!(elapsedMs > 0)) {
    return target;
  }

  const tau = target > previous ? ATTACK_MS : RELEASE_MS;
  return previous + (target - previous) * (1 - Math.exp(-elapsedMs / tau));
}

/**
 * The clip indicator's peak-hold: it takes a rise instantly and only the fall is smoothed. The
 * fill cannot drive the indicator, because the attack that makes the bar readable also swallows
 * the 10–50ms bursts the indicator exists to catch.
 */
export function holdPeak(previous: number, level: number, elapsedMs: number): number {
  if (!(elapsedMs > 0) || level >= previous) {
    return level;
  }

  return level + (previous - level) * Math.exp(-elapsedMs / HOLD_DECAY_MS);
}
