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
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useColors } from '@/theme/provider';
import { motion, radius } from '@/theme/tokens';
import { Icon } from './icon';
import { ringFrame } from './motion';

const IOS = Platform.OS === 'ios';

// The design draws 172 on iOS and 180 on Android, each sized to its own platform's frame,
// inside a stage that leaves room for the rings to expand into.
const DIAMETER = IOS ? 172 : 180;
const RING_WIDTH = IOS ? 2 : 3;
const STAGE = DIAMETER + 40;
const GLYPH = IOS ? 54 : 58;
const GLOW = STAGE * 2;

/**
 * The round control at the centre of the Channel screen, built in plain React Native with
 * Reanimated because `@expo/ui` has no vector or animation surface.
 *
 * It carries the glyph alone, as the design draws it — the word belongs to the screen reader,
 * which is why `label` is the accessibility label rather than visible text.
 *
 * `rings` means the listener has asked for this channel's audio. This run ships no audio
 * path, so nothing downstream of the press exists yet; the note under the target is what
 * says so, and no copy anywhere claims samples are arriving.
 */
export function ListenTarget({
  label,
  active = false,
  rings = false,
  disabled = false,
  onPress,
}: {
  label: string;
  /** Swaps the glyph to the stop shape, the way the web target does while it is playing. */
  active?: boolean;
  rings?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}) {
  const colors = useColors();

  return (
    <View style={styles.stage}>
      {/* The design's wash of brand colour sits behind this control rather than behind the
          screen, so it reads as light coming off the target. iOS only, for the reason
          `ScreenGlow` gives: it is what glass refracts, and Android's frames go without. */}
      {IOS && !disabled ? (
        <View pointerEvents="none" style={styles.glow}>
          <Svg width={GLOW} height={GLOW}>
            <Defs>
              <RadialGradient id="listen-glow" cx="50%" cy="50%" rx="50%" ry="50%">
                <Stop offset="0" stopColor={colors.primary} stopOpacity={rings ? 0.4 : 0.2} />
                <Stop offset="0.72" stopColor={colors.primary} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width={GLOW} height={GLOW} fill="url(#listen-glow)" />
          </Svg>
        </View>
      ) : null}
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
            shadowColor: colors.primary,
            opacity: disabled ? 0.7 : 1,
            transform: [{ scale: pressed ? 0.96 : 1 }],
          },
        ]}
      >
        <Icon
          name={active ? 'stop' : 'listen'}
          size={GLYPH}
          color={colors.primaryForeground}
          filled
        />
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
  glow: { position: 'absolute', width: GLOW, height: GLOW },
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
    shadowOpacity: 0.36,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 16 },
  },
});
