import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
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
import { Icon } from './icon';
import { ringFrame } from './motion';

// The design draws 172 on iOS and 180 on Android, each sized to its own platform's frame,
// inside a stage that leaves room for the rings to expand into.
const DIAMETER = Platform.OS === 'ios' ? 172 : 180;
const RING_WIDTH = Platform.OS === 'ios' ? 2 : 3;
const STAGE = DIAMETER + 40;
const GLYPH = Platform.OS === 'ios' ? 54 : 58;

/**
 * The round control at the centre of the Channel screen, built in plain React Native with
 * Reanimated because `@expo/ui` has no vector or animation surface.
 *
 * It carries the glyph alone, as the design draws it — the word belongs to the screen reader,
 * which is why `label` is the accessibility label rather than visible text.
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
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.target,
          {
            backgroundColor: colors.primary,
            opacity: disabled ? 0.7 : 1,
            transform: [{ scale: pressed ? 0.96 : 1 }],
          },
        ]}
      >
        <Icon name="listen" size={GLYPH} color={colors.primaryForeground} filled />
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
  stage: { width: STAGE, height: STAGE, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute',
    width: DIAMETER,
    height: DIAMETER,
    borderRadius: radius.full,
    borderWidth: RING_WIDTH,
  },
  target: {
    width: DIAMETER,
    height: DIAMETER,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
