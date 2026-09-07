import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/theme/provider';
import { radius, spacing, withAlpha } from '@/theme/tokens';
import { type } from '@/theme/typography';
import { Icon } from './icon';
import type { IconName } from './icons';
import { ripple } from './press';

const IOS = Platform.OS === 'ios';

/**
 * The screen's stated actions. These stay plain React Native rather than `@expo/ui`: they
 * carry brand meaning — the teal that means pressable — and the design reserves the native
 * tier for the controls a listener feels most keenly as fakes.
 *
 * Both variants put dark navy on their fill. The tonal one is a lighter surface, not a
 * lighter ink: teal type on a pale teal surface is the pair the design never uses.
 */
export function ActionButton({
  label,
  icon,
  variant = 'filled',
  onPress,
}: {
  label: string;
  icon: IconName;
  variant?: 'filled' | 'tonal';
  onPress: () => void;
}) {
  const colors = useColors();
  const filled = variant === 'filled';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      android_ripple={ripple(
        withAlpha(filled ? colors.primaryForeground : colors.foreground, 0.14),
      )}
      style={({ pressed }) => [
        styles.button,
        filled ? styles.prominent : styles.tonal,
        {
          backgroundColor: filled ? colors.primary : colors.secondary,
          // The ripple already reports the press on Android, and a control that also shrinks
          // under the finger reads as two controls responding at once.
          transform: [{ scale: IOS && pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <View style={styles.content}>
        <Icon
          name={icon}
          size={filled ? 23 : 20}
          color={filled ? colors.primaryForeground : colors.foreground}
        />
        <Text
          style={[
            type.section,
            styles.label,
            { color: filled ? colors.primaryForeground : colors.foreground },
          ]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    justifyContent: 'center',
    borderRadius: radius.full,
    paddingHorizontal: spacing.actionX,
    // Clips Android's ripple to the pill; without it the wash spills into the square bounds.
    overflow: 'hidden',
  },
  // The design gives the screen's one primary action four points over its neighbour.
  prominent: { minHeight: 60 },
  tonal: { minHeight: spacing.control },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 11 },
  label: { includeFontPadding: false },
});
