import type { ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/theme/provider';
import { spacing } from '@/theme/tokens';
import { type } from '@/theme/typography';
import { GlassSurface } from './glass-surface';
import { Icon } from './icon';

const IOS = Platform.OS === 'ios';

/**
 * Every sheet's title and dismiss control, rendered as content. Android caps a form sheet at
 * three detents and renders neither a header nor a nested stack inside one, so a sheet
 * relying on native chrome would have a title on iOS and none on Android.
 *
 * The header and the body share one scroll container. A `ScrollView` nested beside the
 * header lays out over it inside a form sheet, which supplies no bounded height to resolve
 * that against.
 *
 * The drag handle is drawn on Android and left to the system on iOS. `sheetGrabberVisible`
 * is honoured by UIKit's sheet and by nothing on Android, so Material's handle has to be
 * content like the title beside it.
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
  const { bottom } = useSafeAreaInsets();
  // iOS 26 draws a sheet's close control as a glass disc, like the headers' back control.
  const close = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Done"
      onPress={onDone}
      style={({ pressed }) => [styles.press, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Icon
        name="close"
        size={18}
        color={IOS ? colors.foreground : colors.mutedForeground}
        strokeWidth={IOS ? 2.4 : undefined}
      />
    </Pressable>
  );

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      // A sheet reaches the bottom edge, so its last control would otherwise sit under the home
      // indicator or the gesture handle.
      contentContainerStyle={[styles.sheet, { paddingBottom: bottom + 24 }]}
      contentInsetAdjustmentBehavior="never"
      keyboardShouldPersistTaps="handled"
    >
      {Platform.OS === 'android' ? (
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
      ) : null}
      <View style={styles.header}>
        <View style={styles.titles}>
          {eyebrow ? (
            <Text style={[type.meta, { color: colors.mutedForeground }]}>{eyebrow}</Text>
          ) : null}
          <Text style={[type.title, { color: colors.foreground }]}>{title}</Text>
        </View>
        {IOS ? (
          <GlassSurface interactive style={styles.close}>
            {close}
          </GlassSurface>
        ) : (
          <View style={[styles.close, { backgroundColor: colors.secondary }]}>{close}</View>
        )}
      </View>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: spacing.overlay,
    paddingTop: Platform.OS === 'android' ? 12 : 18,
    gap: 16,
  },
  handle: { width: 32, height: 4, borderRadius: 999, alignSelf: 'center', marginBottom: 2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titles: { flex: 1, gap: 2 },
  close: { width: spacing.action, height: spacing.action, borderRadius: spacing.action / 2 },
  press: {
    width: spacing.action,
    height: spacing.action,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
