import { describe, expect, it } from 'vitest';
import {
  ATTACK_MS,
  HOLD_DECAY_MS,
  holdPeak,
  levelStatus,
  METER_FLOOR_DB,
  meterLevel,
  PEAK_THRESHOLD,
  RELEASE_MS,
  rms,
  smoothLevel,
} from './level';

/** A time-domain frame filled with one sample value. */
function frame(value: number, length = 256) {
  return new Float32Array(length).fill(value);
}

describe('rms', () => {
  it('reads digital silence as zero', () => {
    expect(rms(frame(0))).toBe(0);
  });

  it('reads a full-swing signal as ~1', () => {
    const full = new Float32Array(256);
    for (let i = 0; i < full.length; i++) full[i] = i % 2 === 0 ? -1 : 1;
    expect(rms(full)).toBeCloseTo(1, 5);
  });

  it('reads a constant half-swing offset as ~0.5', () => {
    expect(rms(frame(0.5))).toBeCloseTo(0.5, 5);
  });

  // The reason the frame is float: an 8-bit step is ~-42 dBFS, which a quiet room lives below.
  it('resolves a level far below one 8-bit step', () => {
    expect(rms(frame(1 / 2048))).toBeCloseTo(1 / 2048, 6);
  });

  it('is zero for an empty frame rather than NaN', () => {
    expect(rms(new Float32Array(0))).toBe(0);
  });
});

describe('meterLevel', () => {
  it('puts silence at the bottom and full scale at the top', () => {
    expect(meterLevel(0)).toBe(0);
    expect(meterLevel(1)).toBe(1);
  });

  it('puts the floor itself at zero rather than below it', () => {
    expect(meterLevel(10 ** (METER_FLOOR_DB / 20))).toBeCloseTo(0, 5);
    expect(meterLevel(10 ** ((METER_FLOOR_DB - 20) / 20))).toBe(0);
  });

  // The complaint this scale answers: normal speech is an RMS around 0.1, which a linear bar
  // draws at a tenth of the track.
  it('draws ordinary speech across the middle of the bar', () => {
    const level = meterLevel(0.1);
    expect(level).toBeGreaterThan(0.6);
    expect(level).toBeLessThan(0.75);
  });

  it('is monotonic', () => {
    expect(meterLevel(0.02)).toBeLessThan(meterLevel(0.05));
    expect(meterLevel(0.05)).toBeLessThan(meterLevel(0.2));
  });

  it('rises by a fixed step for every doubling', () => {
    const step = meterLevel(0.5) - meterLevel(0.25);
    expect(meterLevel(0.25) - meterLevel(0.125)).toBeCloseTo(step, 6);
  });
});

describe('levelStatus', () => {
  it('calls a usable level good', () => {
    expect(levelStatus(meterLevel(0.05))).toBe('good');
  });

  it('calls a near-silent level quiet', () => {
    expect(levelStatus(meterLevel(0.002))).toBe('quiet');
  });

  it('calls a clipping level peaking', () => {
    expect(levelStatus(0.9)).toBe('peaking');
  });

  // The tick is drawn at 85%, so the fill reaching it must already read as peaking.
  it('treats the threshold itself as peaking', () => {
    expect(levelStatus(PEAK_THRESHOLD)).toBe('peaking');
    expect(PEAK_THRESHOLD).toBe(0.85);
  });
});

describe('smoothLevel', () => {
  it('moves a fraction of the remaining distance in one frame', () => {
    const next = smoothLevel(0, 1, 16);
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(1);
  });

  it('rises faster than it falls', () => {
    const rise = smoothLevel(0, 1, 16);
    const fall = 1 - smoothLevel(1, 0, 16);
    expect(rise).toBeGreaterThan(fall);
    expect(ATTACK_MS).toBeLessThan(RELEASE_MS);
  });

  it('lands in the same place whether the frame time arrives in one step or two', () => {
    const single = smoothLevel(0, 1, 32);
    const split = smoothLevel(smoothLevel(0, 1, 16), 1, 16);
    expect(single).toBeCloseTo(split, 6);
  });

  it('converges on a held target inside a second without overshooting it', () => {
    let level = 0;
    for (let i = 0; i < 60; i++) {
      level = smoothLevel(level, 0.6, 16);
      expect(level).toBeLessThanOrEqual(0.6);
    }
    expect(level).toBeCloseTo(0.6, 2);
  });

  it('takes the target unchanged when no time has elapsed', () => {
    expect(smoothLevel(0.2, 0.8, 0)).toBe(0.8);
    expect(smoothLevel(0.2, 0.8, -16)).toBe(0.8);
  });

  it('returns the value itself when the target has not moved', () => {
    expect(smoothLevel(0.42, 0.42, 16)).toBe(0.42);
  });

  it('stays inside 0–1 for any 0–1 pair', () => {
    for (const previous of [0, 0.25, 0.5, 1]) {
      for (const target of [0, 0.25, 0.5, 1]) {
        const next = smoothLevel(previous, target, 16);
        expect(next).toBeGreaterThanOrEqual(0);
        expect(next).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('holdPeak', () => {
  it('jumps straight to a raw level above the held one', () => {
    expect(holdPeak(0.2, 0.95, 16)).toBe(0.95);
  });

  it('decays toward a lower level rather than snapping to it', () => {
    const next = holdPeak(0.9, 0.1, 16);
    expect(next).toBeLessThan(0.9);
    expect(next).toBeGreaterThan(0.1);
  });

  it('reaches the lower level eventually', () => {
    let peak = 0.9;
    for (let i = 0; i < 400; i++) peak = holdPeak(peak, 0.1, 16);
    expect(peak).toBeCloseTo(0.1, 2);
  });

  it('decays more slowly than the smoothed fill falls', () => {
    expect(holdPeak(1, 0, 16)).toBeGreaterThan(smoothLevel(1, 0, 16));
    expect(HOLD_DECAY_MS).toBeGreaterThan(RELEASE_MS);
  });

  it('takes the raw level unchanged when no time has elapsed', () => {
    expect(holdPeak(0.9, 0.1, 0)).toBe(0.1);
  });
});

// A peak-hold catches brief clipping that the smoothed meter fill deliberately hides.
describe('a short clipping burst', () => {
  it('reads as peaking on the frame it lands, where the smoothed fill does not', () => {
    const smoothed = smoothLevel(0.4, 0.98, 16);
    const peak = holdPeak(0.4, 0.98, 16);

    expect(levelStatus(smoothed)).not.toBe('peaking');
    expect(levelStatus(peak)).toBe('peaking');
  });

  /**
   * The property, rather than a duration: however the constants are tuned by ear, the fill
   * must never beat the marker to the threshold, or the colour and the words would turn red
   * with nothing on the bar to explain them.
   */
  it('never lets the fill cross the threshold before the marker does', () => {
    let smoothed = 0;
    let peak = 0;
    for (let frame = 0; frame < 60; frame++) {
      smoothed = smoothLevel(smoothed, 0.98, 16);
      peak = holdPeak(peak, 0.98, 16);
      expect(peak).toBeGreaterThanOrEqual(smoothed);
    }
  });
});
