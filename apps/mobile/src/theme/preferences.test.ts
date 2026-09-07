import { describe, expect, it } from '@jest/globals';
import { nativeColorScheme, parseThemePreference, resolveColorScheme } from './preferences';

describe('appearance preference', () => {
  it('defaults missing and malformed storage to System', () => {
    for (const value of [null, '', 'auto', 'DARK', '"dark"', '{}']) {
      expect(parseThemePreference(value)).toBe('system');
    }
  });

  it('restores all three saved choices', () => {
    for (const value of ['system', 'light', 'dark'] as const) {
      expect(parseThemePreference(value)).toBe(value);
    }
  });

  it('follows device changes only in System mode', () => {
    for (const device of ['light', 'dark'] as const) {
      expect(resolveColorScheme('system', device)).toBe(device);
      expect(resolveColorScheme('light', device)).toBe('light');
      expect(resolveColorScheme('dark', device)).toBe('dark');
    }
  });

  it('uses light when the device has no scheme', () => {
    for (const device of [null, undefined, 'unspecified']) {
      expect(resolveColorScheme('system', device)).toBe('light');
    }
  });

  it('clears the native override when returning to System', () => {
    expect(nativeColorScheme('dark')).toBe('dark');
    expect(nativeColorScheme('light')).toBe('light');
    expect(nativeColorScheme('system')).toBe('unspecified');
  });
});
