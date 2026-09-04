import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/icon';
import { useReducedMotion } from '@/components/use-reduced-motion';
import { elevation, radius } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/**
 * A full-screen player is the one place both platforms accept a bespoke transport, so the
 * target itself is shared and only its proportions differ: iOS draws a slightly smaller disc
 * with a finer ring, Android the heavier Material weight.
 */
const SIZE = Platform.select({ ios: 172, default: 180 });
const FIELD = Platform.select({ ios: 210, default: 220 });
const RING_WIDTH = Platform.select({ ios: 2, default: 3 });
const GLYPH = Platform.select({ ios: 54, default: 58 });

const RING_MS = 2600;
const RING_DELAY_MS = RING_MS / 2;
const RING_SCALE = 1.55;
/** The rings stop rather than vanish under reduced motion, held at the frame they start from. */
const RING_RESTING_OPACITY = 0.45;

export type ListenTargetProps = {
  label: string;
  enabled: boolean;
  onPress?: () => void;
};

export function ListenTarget({ label, enabled, onPress }: ListenTargetProps) {
  const theme = useTheme();

  return (
    <View style={styles.field}>
      <Ring />
      <Ring delay={RING_DELAY_MS} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !enabled }}
        disabled={!enabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.disc,
          elevation.goLive,
          { backgroundColor: theme.colors.primary },
          pressed ? { transform: [{ scale: 0.96 }] } : null,
        ]}
      >
        <Icon name="play" size={GLYPH} color="primaryForeground" />
      </Pressable>
    </View>
  );
}

function Ring({ delay = 0 }: { delay?: number }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) {
      progress.setValue(0);
      return;
    }
    const cycle = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: RING_MS,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    // A sequence whose last entry never finishes is how one ring is phased against the other:
    // looping a delayed timing would insert the gap into every cycle instead of once.
    const phased = Animated.sequence([Animated.delay(delay), cycle]);
    phased.start();
    return () => phased.stop();
  }, [delay, progress, reduced]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        { borderColor: theme.colors.primary },
        {
          opacity: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [RING_RESTING_OPACITY, 0],
          }),
          transform: [
            {
              scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, RING_SCALE] }),
            },
          ],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  field: {
    width: FIELD,
    height: FIELD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: radius.full,
    borderWidth: RING_WIDTH,
  },
  disc: {
    width: SIZE,
    height: SIZE,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
