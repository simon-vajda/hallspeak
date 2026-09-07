import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/provider';
import { radius } from '@/theme/tokens';
import { glassMode } from './glass';

/**
 * A panel that becomes liquid glass where the platform actually has it. The check is a
 * runtime call rather than a version comparison: some iOS 26 builds shipped without the API
 * and crash on use.
 *
 * The glass branch draws no border of its own. Glass renders its own edge, and a hairline
 * over the top flattens it into a plain translucent panel — which is what the difference
 * between these surfaces and the scanner's used to be.
 *
 * Never set `opacity: 0` on this view or its parent to hide it — that silently kills the
 * effect. Animate `glassEffectStyle` to `'none'` instead.
 */
export function GlassSurface({
  children,
  style,
  interactive = false,
  tinted = false,
  raised = false,
  fallbackColor,
}: {
  children?: ReactNode;
  style?: ViewStyle;
  /** Gives the glass its specular response to touch, which is most of what reads as glass. */
  interactive?: boolean;
  /** Off by default: over a light ground a clear glass tinted `primary` renders as a solid
   * primary fill, which would make a secondary panel outrank the screen's own action. */
  tinted?: boolean;
  /** The design's cast shadow under a floating control. Glass over a flat page needs it to
   * read as sitting above the page rather than printed on it. */
  raised?: boolean;
  /** The opaque fill where glass is unavailable. Defaults to `card`; the scanner passes its
   * own, because a white panel over a live camera is not a fallback, it is a hole. */
  fallbackColor?: string;
}) {
  const { colors, scheme } = useTheme();
  const shadow = raised ? { ...styles.raised, shadowColor: colors.primary } : null;

  if (glassMode(isGlassEffectAPIAvailable()) === 'glass') {
    return (
      <GlassView
        colorScheme={scheme}
        glassEffectStyle="clear"
        tintColor={tinted ? colors.primary : undefined}
        isInteractive={interactive}
        style={[styles.glass, shadow, style]}
      >
        {children}
      </GlassView>
    );
  }

  // Android's answer is tonal elevation, and a pre-26 iOS build gets the same opaque panel.
  return (
    <View
      style={[
        styles.surface,
        { backgroundColor: fallbackColor ?? colors.card, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  glass: { borderRadius: radius.lg, overflow: 'hidden' },
  surface: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  raised: {
    shadowOpacity: 0.26,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
  },
});
