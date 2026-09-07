import { createContext, type ReactNode, use, useCallback, useMemo, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { nativeColorScheme, resolveColorScheme, type ThemePreference } from './preferences';
import { readThemePreference, saveThemePreference } from './store';
import { type ColorScheme, colors, type Palette, type SurfaceLevel, surfaces } from './tokens';

export type Theme = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  saveFailed: boolean;
  scheme: ColorScheme;
  colors: Palette;
  surfaces: Record<SurfaceLevel, string>;
};

/**
 * The brand seed handed to every `@expo/ui` `Host`. Passing it derives the whole Material 3
 * palette deterministically; omitting it is what lets a wallpaper recolour the app, and a
 * wallpaper must not be able to blur the teal/green distinction.
 */
export const SEED_COLOR = colors.light.primary;

const ThemeContext = createContext<Theme | null>(null);

// Restore the native override at app boot, before any screen or native surface mounts.
// `unspecified` clears it so React Native resumes observing the device's appearance.
const initialPreference = readThemePreference();
Appearance.setColorScheme(nativeColorScheme(initialPreference));

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState(initialPreference);
  const [saveFailed, setSaveFailed] = useState(false);
  const scheme = resolveColorScheme(preference, useColorScheme());
  const setPreference = useCallback((next: ThemePreference) => {
    // Clear the native override before rerendering System, so the hook reads the device
    // scheme rather than the previous explicit choice.
    Appearance.setColorScheme(nativeColorScheme(next));
    setPreferenceState(next);
    setSaveFailed(!saveThemePreference(next));
  }, []);
  const theme = useMemo(
    () => ({
      preference,
      setPreference,
      saveFailed,
      scheme,
      colors: colors[scheme],
      surfaces: surfaces[scheme],
    }),
    [preference, setPreference, saveFailed, scheme],
  );

  return <ThemeContext value={theme}>{children}</ThemeContext>;
}

export function useTheme(): Theme {
  const theme = use(ThemeContext);

  if (!theme) {
    throw new Error('useTheme must be called inside a ThemeProvider.');
  }

  return theme;
}

export function useColors(): Palette {
  return useTheme().colors;
}

/**
 * Material 3's tonal containers, resolved for the active scheme. Android-only by intent: on
 * iOS depth is glass and a cast shadow, so a stepped surface there would be a second answer
 * to a question the platform has already answered.
 */
export function useSurfaces(): Record<SurfaceLevel, string> {
  return useTheme().surfaces;
}
