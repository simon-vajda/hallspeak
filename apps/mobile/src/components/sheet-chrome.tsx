import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/theme/provider';
import { spacing } from '@/theme/tokens';
import { type } from '@/theme/typography';
import { Icon } from './icon';

/**
 * Every sheet's title and dismiss control, rendered as content. Android caps a form sheet at
 * three detents and renders neither a header nor a nested stack inside one, so a sheet that
 * relied on native chrome would have a title on iOS and none on Android.
 */
export function SheetChrome({
  title,
  eyebrow,
  onDone,
  children,
}: {
  title: string;
  eyebrow?: string;
  onDone: () => void;
  children: ReactNode;
}) {
  const colors = useColors();

  return (
    <View style={[styles.sheet, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={styles.titles}>
          {eyebrow ? (
            <Text style={[type.meta, { color: colors.mutedForeground }]}>{eyebrow}</Text>
          ) : null}
          <Text style={[type.title, { color: colors.foreground }]}>{title}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Done"
          onPress={onDone}
          style={[styles.close, { backgroundColor: colors.secondary }]}
        >
          <Icon name="close" size={18} color={colors.mutedForeground} />
        </Pressable>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, paddingHorizontal: spacing.gutter, paddingTop: 18, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  titles: { flex: 1, gap: 2 },
  close: {
    width: spacing.action,
    height: spacing.action,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
