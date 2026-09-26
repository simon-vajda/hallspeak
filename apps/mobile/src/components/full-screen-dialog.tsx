import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/theme/provider';
import { column } from '@/theme/shape';
import { spacing, withAlpha } from '@/theme/tokens';
import { type } from '@/theme/typography';
import { Icon } from './icon';
import { ripple } from './press';

/**
 * Android only. Material 3's full-screen dialog: a flat top bar with a close icon at the start
 * and the title beside it, over a body that scrolls. Takes the same props as `SheetChrome`, so a
 * route can pick its chrome per platform.
 */
export function FullScreenDialog({
  title,
  onDone,
  children,
}: {
  title: string;
  onDone: () => void;
  children: ReactNode;
}) {
  const colors = useColors();
  const { top, bottom } = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: top }]}>
      <View style={styles.bar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onDone}
          android_ripple={ripple(withAlpha(colors.foreground, 0.12), true)}
          style={styles.close}
        >
          <Icon name="close" size={24} color={colors.foreground} />
        </Pressable>
        <Text numberOfLines={1} style={[type.title, styles.title, { color: colors.foreground }]}>
          {title}
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', height: 64, paddingHorizontal: 4, gap: 4 },
  close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1 },
  body: {
    ...column,
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.overlay,
    gap: 16,
  },
});
