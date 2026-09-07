import { Platform, StyleSheet, TextInput } from 'react-native';
import { useColors } from '@/theme/provider';
import { radius, spacing } from '@/theme/tokens';
import { type } from '@/theme/typography';

/**
 * React Native's own text field rather than `@expo/ui`'s. The design's build notes reserve
 * the native tier for the switch, the slider and the picker — the controls a listener feels
 * most keenly as fakes — and a URL field is not among them. The universal one also draws no
 * container on Android, which leaves its placeholder floating over nothing.
 */
export function LinkField({
  value,
  onChangeText,
  onSubmitEditing,
}: {
  value: string;
  onChangeText: (next: string) => void;
  onSubmitEditing: () => void;
}) {
  const colors = useColors();

  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      onSubmitEditing={onSubmitEditing}
      placeholder="https://…"
      placeholderTextColor={colors.mutedForeground}
      selectionColor={colors.primary}
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete="url"
      keyboardType="url"
      inputMode="url"
      returnKeyType="go"
      style={[
        type.bodyLg,
        styles.field,
        Platform.OS === 'ios' && styles.iosText,
        { backgroundColor: colors.card, borderColor: colors.input, color: colors.foreground },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: spacing.pill + 8,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  // UIKit lays a single-line field's text out against the line box rather than the frame, so a
  // line height taller than the glyphs pushes it off centre. Android measures from the frame and
  // keeps the ramp's value.
  iosText: {
    lineHeight: undefined,
    paddingVertical: 0,
  },
});
