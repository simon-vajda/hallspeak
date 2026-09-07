import { createContext, type ReactNode, use, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { type ColorScheme, colors, type Palette } from './tokens';

export type Theme = {
  scheme: ColorScheme;
  colors: Palette;
};

/**
 * The brand seed handed to every `@expo/ui` `Host`. Passing it derives the whole Material 3
 * palette deterministically; omitting it is what lets a wallpaper recolour the app, and a
 * wallpaper must not be able to blur the teal/green distinction.
 */
export const SEED_COLOR = colors.light.primary;

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme: ColorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const theme = useMemo(() => ({ scheme, colors: colors[scheme] }), [scheme]);

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
