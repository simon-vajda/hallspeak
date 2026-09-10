import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useColors } from '@/theme/provider';
import { radius } from '@/theme/tokens';
import { Icon } from './icon';
import { ListenerRing } from './listener-ring';

const IOS = Platform.OS === 'ios';

// The design draws 172 on iOS and 180 on Android, each sized to its own platform's frame,
// inside a stage that leaves room for the rings to expand into.
const DIAMETER = IOS ? 172 : 180;
// The rings expand inside the stage rather than past it, so neither the channel name above
// nor the connection line below is ever touched.
const RING_TRAVEL = 0.3;
const STAGE = Math.ceil(DIAMETER * (1 + RING_TRAVEL));
const GLYPH = IOS ? 54 : 58;
// Oversize the iOS wash so its falloff stays soft beyond the target without reaching app bar.
const GLOW_WIDTH = STAGE * 2.75;
const GLOW_HEIGHT = STAGE * 2.75;

/**
 * The round control at the centre of the Channel screen, built in plain React Native with
 * Reanimated because `@expo/ui` has no vector or animation surface.
 *
 * It carries the glyph alone, as the design draws it — the word belongs to the screen reader,
 * which is why `label` is the accessibility label rather than visible text.
 *
 * `rings` means a resumed consumer exists — samples are arriving — rather than that the
 * control was pressed, so they claim audio the guest can actually hear.
 */
export function ListenTarget({
  label,
  active = false,
  loading = false,
  rings = false,
  muted = false,
  disabled = false,
  onPress,
}: {
  label: string;
  /** Swaps the glyph to the stop shape, the way the web target does while it is playing. */
  active?: boolean;
  loading?: boolean;
  rings?: boolean;
  /** A muted producer lets existing rings settle; other stops remain immediate. */
  muted?: boolean;
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
          <Svg width={GLOW_WIDTH} height={GLOW_HEIGHT}>
            <Defs>
              <RadialGradient id="listen-glow" cx="50%" cy="50%" rx="50%" ry="50%">
                <Stop offset="0" stopColor={colors.primary} stopOpacity="0.16" />
                <Stop offset="0.82" stopColor={colors.primary} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width={GLOW_WIDTH} height={GLOW_HEIGHT} fill="url(#listen-glow)" />
          </Svg>
        </View>
      ) : null}
      <ListenerRing
        diameter={DIAMETER}
        travel={RING_TRAVEL}
        running={rings}
        settling={active && muted}
        color={colors.primary}
      />
      <ListenerRing
        diameter={DIAMETER}
        travel={RING_TRAVEL}
        running={rings}
        settling={active && muted}
        color={colors.primary}
        delayed
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: disabled || loading, busy: loading }}
        disabled={disabled || loading}
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
        {loading ? (
          <ActivityIndicator size="large" color={colors.primaryForeground} />
        ) : (
          <Icon
            name={active ? 'stop' : 'listen'}
            size={GLYPH}
            color={colors.primaryForeground}
            filled
          />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { width: STAGE, height: STAGE, alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute',
    left: (STAGE - GLOW_WIDTH) / 2,
    top: (STAGE - GLOW_HEIGHT) / 2,
    width: GLOW_WIDTH,
    height: GLOW_HEIGHT,
  },
  target: {
    width: DIAMETER,
    height: DIAMETER,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.32,
    shadowRadius: 42,
    shadowOffset: { width: 0, height: 18 },
  },
});
