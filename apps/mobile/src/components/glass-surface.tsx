import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useColors } from '@/theme/provider';
import { radius } from '@/theme/tokens';
import { glassMode } from './glass';

/**
 * A panel that becomes liquid glass where the platform actually has it. The check is a
 * runtime call rather than a version comparison: some iOS 26 builds shipped without the API
 * and crash on use.
 *
 * Never set `opacity: 0` on this view or its parent to hide it — that silently kills the
 * effect. Animate `glassEffectStyle` to `'none'` instead.
 */
export function GlassSurface({
  children,
  style,
  interactive = false,
}: {
  children?: ReactNode;
  style?: ViewStyle;
  interactive?: boolean;
}) {
  const colors = useColors();

  if (glassMode(isGlassEffectAPIAvailable()) === 'glass') {
    return (
      <GlassView
        glassEffectStyle="clear"
        tintColor={colors.primary}
        isInteractive={interactive}
        style={[styles.surface, style]}
      >
        {children}
      </GlassView>
    );
  }

  // Android's answer is tonal elevation, and a pre-26 iOS build gets the same opaque panel.
  return (
    <View
      style={[styles.surface, { backgroundColor: colors.card, borderColor: colors.border }, style]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
});
