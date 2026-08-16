import { describe, expect, it } from 'vitest';
import { formatPin, plural } from './format';

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
