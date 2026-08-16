import { describe, expect, it } from 'vitest';
import { formatElapsed, formatPin, plural } from './format';

describe('formatPin', () => {
  it('groups the six digits 3+3', () => {
    expect(formatPin('834912')).toBe('834 912');
  });
});

describe('plural', () => {
  it('drops the s at one', () => {
    expect(plural(1, 'channel')).toBe('1 channel');
  });

  it('keeps the s at zero and above one', () => {
    expect(plural(0, 'channel')).toBe('0 channels');
    expect(plural(2, 'channel')).toBe('2 channels');
  });
});

describe('formatElapsed', () => {
  it('starts at zero', () => {
    expect(formatElapsed(0)).toBe('0:00');
  });

  it('pads the seconds but not the leading minutes', () => {
    expect(formatElapsed(61_000)).toBe('1:01');
    expect(formatElapsed(9_000)).toBe('0:09');
  });

  it('drops sub-second remainders rather than rounding up', () => {
    expect(formatElapsed(59_999)).toBe('0:59');
  });

  it('keeps the MM:SS form up to the last second before the hour', () => {
    expect(formatElapsed(3_599_000)).toBe('59:59');
  });

  it('grows an hour field at the hour, padding the minutes', () => {
    expect(formatElapsed(3_600_000)).toBe('1:00:00');
    expect(formatElapsed(3_661_000)).toBe('1:01:01');
  });

  it('leaves the hour field unpadded past ten hours', () => {
    expect(formatElapsed(45_296_000)).toBe('12:34:56');
  });

  it('treats a negative span as zero, so a clock skew cannot print -1:-1', () => {
    expect(formatElapsed(-5_000)).toBe('0:00');
  });
});
