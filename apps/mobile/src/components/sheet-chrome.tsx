import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/theme/provider';
import { radius, spacing } from '@/theme/tokens';
import { type } from '@/theme/typography';
import { Icon } from './icon';

/**
 * Every sheet's title and dismiss control, rendered as content. Android caps a form sheet at
 * three detents and renders neither a header nor a nested stack inside one, so a sheet
 * relying on native chrome would have a title on iOS and none on Android.
 *
 * The header and the body share one scroll container. A `ScrollView` nested beside the
 * header lays out over it inside a form sheet, which supplies no bounded height to resolve
 * that against.
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
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.sheet}
      contentInsetAdjustmentBehavior="never"
    >
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: spacing.gutter, paddingTop: 18, paddingBottom: 32, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  titles: { flex: 1, gap: 2 },
  close: {
    width: spacing.action,
    height: spacing.action,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
