import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/provider';
import { radius, scrim, withAlpha } from '@/theme/tokens';
import { type } from '@/theme/typography';
import { ripple } from './press';

/**
 * Android only. Material 3's basic dialog: a `surfaces.high` container with 28dp corners
 * between 280 and 560dp wide, a headline, a body that scrolls on its own, and text actions
 * aligned to the end. It has no close control; a text action or a tap on the scrim dismisses.
 */
export function MaterialDialog({
  title,
  onDismiss,
  actions,
  children,
}: {
  title: string;
  onDismiss: () => void;
  actions: { label: string; onPress: () => void }[];
  children: ReactNode;
}) {
  const { colors, surfaces } = useTheme();

  return (
    <View style={styles.frame}>
      <Pressable
        accessible={false}
        importantForAccessibility="no"
        onPress={onDismiss}
        style={[StyleSheet.absoluteFill, { backgroundColor: scrim }]}
      />
      <View accessibilityViewIsModal style={[styles.container, { backgroundColor: surfaces.high }]}>
        <Text style={[type.title, styles.headline, { color: colors.foreground }]}>{title}</Text>
        <ScrollView style={styles.body}>{children}</ScrollView>
        <View style={styles.actions}>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              onPress={action.onPress}
              android_ripple={ripple(withAlpha(colors.primary, 0.14))}
              style={styles.action}
            >
              <Text style={[type.bodyStrong, { color: colors.primary }]}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 48 },
  container: {
    minWidth: 280,
    maxWidth: 560,
    width: '100%',
    maxHeight: '100%',
    borderRadius: radius.xl,
    overflow: 'hidden',
    paddingTop: 24,
    paddingBottom: 20,
  },
  headline: { paddingHorizontal: 24, paddingBottom: 16 },
  body: { flexGrow: 0 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  action: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'center',
  },
});
