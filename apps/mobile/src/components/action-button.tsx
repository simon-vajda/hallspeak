import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/theme/provider';
import { radius, spacing } from '@/theme/tokens';
import { type } from '@/theme/typography';
import { Icon } from './icon';
import type { IconName } from './icons';

/**
 * The screen's stated actions. These stay plain React Native rather than `@expo/ui`: they
 * carry brand meaning — the teal that means pressable — and the design reserves the native
 * tier for the controls a listener feels most keenly as fakes, which are the switch, the
 * slider, the picker and the text field.
 */
export function ActionButton({
  label,
  icon,
  variant = 'filled',
  onPress,
}: {
  label: string;
  icon: IconName;
  variant?: 'filled' | 'outlined';
  onPress: () => void;
}) {
  const colors = useColors();
  const filled = variant === 'filled';
  const foreground = filled ? colors.primaryForeground : colors.primary;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: filled ? colors.primary : colors.secondary,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <View style={styles.content}>
        <Icon name={icon} size={20} color={foreground} />
        <Text style={[type.section, styles.label, { color: foreground }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: spacing.pill,
    justifyContent: 'center',
    borderRadius: radius.full,
    paddingHorizontal: spacing.actionX,
  },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  label: { includeFontPadding: false },
});
