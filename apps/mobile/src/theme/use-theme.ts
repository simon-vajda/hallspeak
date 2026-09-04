import { useColorScheme } from 'react-native';
import { type ColorSet, colors } from './tokens';

export type Theme = {
  scheme: 'light' | 'dark';
  colors: ColorSet;
};

export function useTheme(): Theme {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { scheme, colors: colors[scheme] };
}
