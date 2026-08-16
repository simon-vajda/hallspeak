import { describe, expect, it } from 'vitest';
import { levelStatus, PEAK_THRESHOLD, rms } from './level';

/** A byte-domain frame filled with one sample value. */
function frame(value: number, length = 256) {
  return new Uint8Array(length).fill(value);
}

describe('rms', () => {
  it('reads digital silence as zero', () => {
    expect(rms(frame(128))).toBe(0);
  });

  it('reads a full-swing signal as ~1', () => {
    const full = new Uint8Array(256);
    for (let i = 0; i < full.length; i++) full[i] = i % 2 === 0 ? 0 : 255;
    expect(rms(full)).toBeCloseTo(1, 2);
  });

  it('reads a constant half-swing offset as ~0.5', () => {
    expect(rms(frame(192))).toBeCloseTo(0.5, 2);
  });

  it('is zero for an empty frame rather than NaN', () => {
    expect(rms(new Uint8Array(0))).toBe(0);
  });
});

describe('levelStatus', () => {
  it('calls a usable level good', () => {
    expect(levelStatus(0.4)).toBe('good');
  });

  it('calls a near-silent level quiet', () => {
    expect(levelStatus(0.02)).toBe('quiet');
  });

  it('calls a clipping level peaking', () => {
    expect(levelStatus(0.9)).toBe('peaking');
  });

  // the tick is drawn *at* 85%, so the fill reaching it must already read as peaking —
  // otherwise the colour change and the mark disagree by one frame's worth of level
  it('treats the threshold itself as peaking', () => {
    expect(levelStatus(PEAK_THRESHOLD)).toBe('peaking');
    expect(PEAK_THRESHOLD).toBe(0.85);
  });
});
