import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useColors } from '@/theme/provider';
import { motion, radius } from '@/theme/tokens';
import { type } from '@/theme/typography';
import { ICON_STROKE_LARGE, Icon } from './icon';
import { ringFrame } from './motion';

const DIAMETER = 176;

/**
 * The round control at the centre of the Channel screen, built in plain React Native with
 * Reanimated because `@expo/ui` has no vector or animation surface.
 *
 * `rings` means audio is moving, not that a socket is open. This run ships no audio path, so
 * the target is deliberately inert: it renders, it answers a press with the platform's own
 * feedback, and it starts nothing.
 */
export function ListenTarget({
  label,
  rings = false,
  disabled = false,
  onPress,
}: {
  label: string;
  rings?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}) {
  const colors = useColors();

  return (
    <View style={styles.stage}>
      {rings ? (
        <>
          <Ring color={colors.primary} />
          <Ring color={colors.primary} delayed />
        </>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.target,
          {
            backgroundColor: colors.primary,
            opacity: disabled ? 0.5 : 1,
            transform: [{ scale: pressed ? 0.96 : 1 }],
          },
        ]}
      >
        <Icon
          name="listen"
          size={39}
          color={colors.primaryForeground}
          strokeWidth={ICON_STROKE_LARGE}
        />
        <Text style={[type.section, styles.label, { color: colors.primaryForeground }]}>
          {label}
        </Text>
      </Pressable>
    </View>
  );
}

function Ring({ color, delayed = false }: { color: string; delayed?: boolean }) {
  const reduceMotion = useReducedMotion();
  const frame = ringFrame(reduceMotion);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!frame.animated) {
      progress.value = 0;
      return;
    }

    const run = withRepeat(
      withTiming(1, { duration: motion.ringMs, easing: Easing.out(Easing.ease) }),
      -1,
      false,
    );

    progress.value = delayed ? withDelay(motion.ringDelayMs, run) : run;
  }, [frame.animated, delayed, progress]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + progress.value * 0.55 }],
    opacity: frame.opacity * (1 - progress.value),
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.ring, { borderColor: color }, style]} />
  );
}

const styles = StyleSheet.create({
  stage: { width: DIAMETER, height: DIAMETER, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: DIAMETER,
    height: DIAMETER,
    borderRadius: radius.full,
    borderWidth: 2,
  },
  target: {
    width: DIAMETER,
    height: DIAMETER,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: { includeFontPadding: false },
});
