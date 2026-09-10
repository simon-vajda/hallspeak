import { useEffect } from 'react';
import { Platform } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { motion, radius } from '@/theme/tokens';
import { ringFrame } from './motion';

const SETTLE_MS = 280;

/** Kept mounted so muting can settle the current frame instead of removing it. */
export function ListenerRing({
  color,
  diameter,
  travel,
  running,
  settling,
  delayed = false,
}: {
  color: string;
  diameter: number;
  travel: number;
  running: boolean;
  settling: boolean;
  delayed?: boolean;
}) {
  const frame = ringFrame(useReducedMotion());
  const progress = useSharedValue(0);
  const presence = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(progress);
    cancelAnimation(presence);

    if (!frame.animated) {
      progress.value = 0;
      presence.value = running ? 1 : 0;
    } else if (!running) {
      // Freeze the outward phase. Only its distance and opacity diminish during mute.
      presence.value = settling
        ? withTiming(0, { duration: SETTLE_MS, easing: Easing.out(Easing.cubic) })
        : 0;
      if (!settling) {
        progress.value = 0;
      }
    } else {
      presence.value = withTiming(1, { duration: motion.pressMs });
      const timing = { duration: motion.ringMs, easing: Easing.out(Easing.ease) };
      // Finish the interrupted phase before returning to full cycles. Explicitly resetting
      // each repeat prevents a rapid unmute from making its partial phase the new baseline.
      const run = withSequence(
        withTiming(1, { ...timing, duration: motion.ringMs * (1 - progress.value) }),
        withRepeat(withSequence(withTiming(0, { duration: 0 }), withTiming(1, timing)), -1, false),
      );
      progress.value = delayed && progress.value === 0 ? withDelay(motion.ringDelayMs, run) : run;
    }

    return () => {
      cancelAnimation(progress);
      cancelAnimation(presence);
    };
  }, [running, settling, frame.animated, delayed, progress, presence]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + progress.value * travel * presence.value }],
    opacity: frame.opacity * (1 - progress.value) * presence.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: diameter,
          height: diameter,
          borderRadius: radius.full,
          borderWidth: Platform.OS === 'ios' ? 2 : 3,
          borderColor: color,
        },
        style,
      ]}
    />
  );
}
