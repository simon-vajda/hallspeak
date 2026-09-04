import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { elevation, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

export type SurfaceProps = ViewProps & {
  children?: ReactNode;
  padded?: boolean;
};

export function Surface({ padded = true, style, ...rest }: SurfaceProps) {
  const theme = useTheme();

  return (
    <View
      {...rest}
      style={StyleSheet.compose(
        {
          backgroundColor: theme.colors.card,
          borderRadius: radius.lg,
          borderWidth: elevation.cardRingWidth,
          borderColor: theme.colors.cardRing,
          padding: padded ? spacing.panel : undefined,
        },
        style,
      )}
    />
  );
}
