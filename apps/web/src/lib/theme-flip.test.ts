import { describe, expect, it } from 'vitest';
import { themeFlip } from './theme-flip';

describe('themeFlip', () => {
  it('offers light from dark', () => {
    expect(themeFlip('dark', false)).toEqual({ next: 'light', label: 'Switch to light theme' });
  });

  it('offers dark from light', () => {
    expect(themeFlip('light', true)).toEqual({ next: 'dark', label: 'Switch to dark theme' });
  });

  it('follows the system preference while the theme is system', () => {
    expect(themeFlip('system', true).next).toBe('light');
    expect(themeFlip('system', false).next).toBe('dark');
  });
});
