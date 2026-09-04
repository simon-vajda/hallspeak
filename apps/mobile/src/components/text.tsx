import { Text as RNText, type TextProps as RNTextProps, StyleSheet } from 'react-native';
import { type ColorName, fontFamilies, type TypeName, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

export type TextProps = RNTextProps & {
  variant?: TypeName;
  color?: ColorName;
  uppercase?: boolean;
};

export function Text({
  variant = 'body',
  color = 'foreground',
  uppercase = false,
  style,
  ...rest
}: TextProps) {
  const theme = useTheme();
  const step = typography[variant];

  return (
    <RNText
      {...rest}
      style={StyleSheet.compose(
        {
          fontFamily: fontFamilies[step.fontWeight],
          fontSize: step.fontSize,
          lineHeight: step.lineHeight,
          letterSpacing: 'letterSpacing' in step ? step.letterSpacing : undefined,
          color: theme.colors[color],
          textTransform: uppercase ? 'uppercase' : undefined,
        },
        style,
      )}
    />
  );
}
