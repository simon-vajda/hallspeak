import { describe, expect, it } from '@jest/globals';
import { pressOpacity, ripple } from './press';

describe('ripple', () => {
  it('is Android only and draws over the surface it presses', () => {
    expect(ripple('#00000014', false, 'android')).toEqual({
      color: '#00000014',
      borderless: false,
      foreground: true,
    });
    expect(ripple('#00000014', false, 'ios')).toBeUndefined();
  });
});

describe('pressOpacity', () => {
  it('dims on iOS and leaves the ripple alone on Android', () => {
    expect(pressOpacity(true, 0.9, 'ios')).toBe(0.9);
    expect(pressOpacity(false, 0.9, 'ios')).toBe(1);
    expect(pressOpacity(true, 0.9, 'android')).toBe(1);
  });
});
