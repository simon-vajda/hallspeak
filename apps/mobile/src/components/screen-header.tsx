import { type Href, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/theme/provider';
import { column } from '@/theme/shape';
import { spacing } from '@/theme/tokens';
import { type } from '@/theme/typography';
import { GlassSurface } from './glass-surface';
import { Icon } from './icon';

const IOS = Platform.OS === 'ios';
const BUTTON = IOS ? 38 : 48;

/**
 * The design's own header row, drawn as content rather than taken from the navigator.
 *
 * Three things follow from owning it. The back control is a glass disc carrying a chevron
 * and nothing else, the way iOS itself draws one over a scrolling surface — the native
 * header would instead print the previous screen's title beside it, which is a word the
 * design never has room for and which reads as the wrong half of the product once this app
 * opens a speaker's link too. Android gets Material's flat 48px target with no elevated bar
 * behind it, so nothing casts the drop shadow that dates a plain top app bar. And the
 * screen's own background — a glow included — runs under the row instead of stopping at it.
 */
export function ScreenHeader({
  backHref,
  title,
  menu,
}: {
  backHref: Href;
  title?: string;
  /** Sits opposite the back control at the same width, so a centred title stays centred. */
  menu?: ReactNode;
}) {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const back = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={() => router.dismissTo(backHref)}
      style={({ pressed }) => [styles.press, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Icon
        name={IOS ? 'backChevron' : 'back'}
        size={IOS ? 18 : 22}
        color={colors.foreground}
        strokeWidth={IOS ? 2.4 : 2}
      />
    </Pressable>
  );

  return (
    <View style={[styles.row, { paddingTop: insets.top + (IOS ? 4 : 6) }]}>
      {IOS ? (
        <GlassSurface interactive raised style={styles.disc}>
          {back}
        </GlassSurface>
      ) : (
        back
      )}
      <View style={styles.title}>
        {title ? (
          <Text numberOfLines={1} style={[type.section, styles.text, { color: colors.foreground }]}>
            {title}
          </Text>
        ) : null}
      </View>
      {menu ?? (
        // Balances the back control so a centred title stays centred.
        <View style={styles.press} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    ...column,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.gutter,
  },
  disc: { width: BUTTON, height: BUTTON, borderRadius: BUTTON / 2 },
  press: { width: BUTTON, height: BUTTON, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, minWidth: 0 },
  text: { textAlign: 'center' },
});
