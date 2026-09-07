import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useColors } from '@/theme/provider';
import { motion } from '@/theme/tokens';
import { liveDotFrame } from './motion';

const SIZES = { sm: 7, md: 10 } as const;

/**
 * `offline` is a tone rather than the absence of the element: dropping the dot would shift
 * everything beside it as channels go on and off air.
 */
export function LiveDot({
  size = 'md',
  tone = 'live',
}: {
  size?: keyof typeof SIZES;
  tone?: 'live' | 'offline';
}) {
  const colors = useColors();
  const reduceMotion = useReducedMotion();
  const frame = liveDotFrame(reduceMotion);
  const opacity = useSharedValue(frame.opacity);
  const live = tone === 'live';

  useEffect(() => {
    if (!live || !frame.animated) {
      opacity.value = frame.opacity;
      return;
    }

    opacity.value = withRepeat(
      withTiming(0.45, { duration: motion.pulseLiveMs / 2, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [live, frame.animated, frame.opacity, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const diameter = SIZES[size];
  const shape = {
    width: diameter,
    height: diameter,
    borderRadius: diameter / 2,
    backgroundColor: live ? colors.live : colors.border,
  };

  if (!live) {
    return <View style={[styles.dot, shape]} />;
  }

  return <Animated.View style={[styles.dot, shape, style]} />;
}

const styles = StyleSheet.create({
  dot: { flexShrink: 0 },
});
