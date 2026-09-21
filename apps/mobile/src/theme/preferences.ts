import type { ColorScheme } from './tokens';

export type ThemePreference = 'system' | ColorScheme;

export const THEME_STORAGE_KEY = 'hallspeak-appearance';

export function parseThemePreference(value: string | null): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}

export function nativeColorScheme(preference: ThemePreference) {
  return preference === 'system' ? 'unspecified' : preference;
}

export function resolveColorScheme(
  preference: ThemePreference,
  deviceScheme: string | null | undefined,
): ColorScheme {
  return preference === 'system' ? (deviceScheme === 'dark' ? 'dark' : 'light') : preference;
}
