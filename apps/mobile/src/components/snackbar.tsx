import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/theme/provider';
import { radius, spacing } from '@/theme/tokens';
import { type } from '@/theme/typography';

export const SNACKBAR_MS = 5_000;

/**
 * A removal is undoable rather than confirmed in advance. A modal alert asks the guest to
 * predict what they want before they can see the result, and the platform dialogs it opens
 * are the least native-looking surface either OS still ships.
 */
export function Snackbar({
  message,
  actionLabel,
  onAction,
  onDismiss,
}: {
  message: string;
  actionLabel: string;
  onAction: () => void;
  onDismiss: () => void;
}) {
  const colors = useColors();

  useEffect(() => {
    const timer = setTimeout(onDismiss, SNACKBAR_MS);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <View style={[styles.bar, { backgroundColor: colors.foreground }]}>
      <Text numberOfLines={1} style={[type.body, styles.message, { color: colors.background }]}>
        {message}
      </Text>
      <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
        <Text style={[type.section, { color: colors.primary }]}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: spacing.gutter,
    right: spacing.gutter,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minHeight: spacing.touch + 4,
    paddingHorizontal: 18,
    borderRadius: radius.md,
  },
  message: { flex: 1 },
});
