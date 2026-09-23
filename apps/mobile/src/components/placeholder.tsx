import { useEffect } from 'react';
import { type DimensionValue, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useColors, useSurfaces } from '@/theme/provider';
import { motion } from '@/theme/tokens';
import { type TypeStep, type } from '@/theme/typography';
import { placeholderFrame } from './motion';

const IOS = Platform.OS === 'ios';

/**
 * A block standing in for content that has not arrived, drawn at that content's size so its
 * arrival is a data change rather than a re-layout.
 *
 * It is hidden from assistive technology: the skeleton that holds it announces loading once
 * for the whole screen, and a screen reader stepping through each block would read nothing.
 *
 * `pill` rounds by half the block's own height, not `radius.full`: Android drops an oversized
 * radius and draws a square.
 */
export function Placeholder({
  width,
  height,
  radius = 'pill',
}: {
  width: DimensionValue;
  height: number;
  radius?: number | 'pill';
}) {
  const colors = useColors();
  const surfaces = useSurfaces();
  const reduceMotion = useReducedMotion();
  const frame = placeholderFrame(reduceMotion);
  const opacity = useSharedValue(frame.opacity);

  useEffect(() => {
    if (!frame.animated) {
      opacity.value = frame.opacity;
      return;
    }

    opacity.value = withRepeat(
      withTiming(motion.placeholderDimOpacity, {
        duration: motion.placeholderPulseMs / 2,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );
  }, [frame.animated, frame.opacity, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.block,
        {
          width,
          height,
          borderRadius: radius === 'pill' ? height / 2 : radius,
          backgroundColor: IOS ? colors.muted : surfaces.highest,
        },
        style,
      ]}
    />
  );
}

/**
 * A placeholder for one line of text, standing at exactly the height that line takes: an
 * invisible line of the same type step holds the slot, so the text replacing it lands without
 * moving anything around it. The block is drawn at the step's cap height rather than its line
 * height, the way a line of type reads.
 */
export function PlaceholderLine({
  step,
  width,
  centred = false,
}: {
  step: TypeStep;
  width: DimensionValue;
  centred?: boolean;
}) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.line}
    >
      <Text style={[type[step], styles.holder]}> </Text>
      <View style={[styles.overlay, centred ? styles.centred : null]}>
        <Placeholder width={width} height={Math.round(type[step].fontSize * 0.8)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { flexShrink: 0 },
  line: { alignSelf: 'stretch' },
  holder: { color: 'transparent' },
  overlay: { ...StyleSheet.absoluteFill, justifyContent: 'center' },
  centred: { alignItems: 'center' },
});
