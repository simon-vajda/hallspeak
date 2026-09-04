import { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { useReducedMotion } from '@/components/use-reduced-motion';
import { radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const DOT_SIZE = spacing.step * 2.25;
const PULSE_MS = 2000;
/** The dot is a status, so its quiet frame is solid rather than the dimmer half of the pulse. */
const RESTING_OPACITY = 1;
const DIM_OPACITY = 0.45;

export type LiveBadgeProps = {
  label: string;
};

/** The chip above the channel name. Green here means a Producer exists, never that audio plays. */
export function LiveBadge({ label }: LiveBadgeProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(RESTING_OPACITY)).current;

  useEffect(() => {
    if (reduced) {
      opacity.setValue(RESTING_OPACITY);
      return;
    }
    const half = { duration: PULSE_MS / 2, useNativeDriver: true };
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { ...half, toValue: DIM_OPACITY }),
        Animated.timing(opacity, { ...half, toValue: RESTING_OPACITY }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity, reduced]);

  return (
    <View
      accessibilityRole="text"
      style={[
        styles.chip,
        {
          backgroundColor: theme.colors.liveMuted,
          borderColor: HAIRLINE ? theme.colors.live : 'transparent',
        },
      ]}
    >
      <Animated.View style={[styles.dot, { backgroundColor: theme.colors.live, opacity }]} />
      <Text variant="meta" color="liveOnMuted" style={styles.label}>
        {label}
      </Text>
    </View>
  );
}

/** iOS draws the chip's hairline; Android's Material chip carries the wash alone. */
const HAIRLINE = Platform.select({ ios: true, default: false });

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.step * 2.25,
    paddingVertical: spacing.step * 2.25,
    paddingHorizontal: spacing.actionX,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: radius.full,
  },
  label: {
    letterSpacing: Platform.select({ ios: 0, default: 0.27 }),
  },
});
