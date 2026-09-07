import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/theme/provider';
import { radius } from '@/theme/tokens';
import { type } from '@/theme/typography';
import { Icon } from './icon';

/**
 * A link this phone refused, with the reason. Both entry paths show it, and neither has
 * contacted a server to produce it.
 */
export function RefusalBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const colors = useColors();

  const content = (
    <>
      <Icon name="warn" size={16} color={colors.destructive} />
      <Text style={[type.note, styles.text, { color: colors.destructive }]}>{message}</Text>
    </>
  );

  const style = [styles.banner, { backgroundColor: colors.destructiveMuted }];

  if (!onRetry) {
    return <View style={style}>{content}</View>;
  }

  return (
    <Pressable accessibilityRole="button" onPress={onRetry} style={style}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: radius.md,
  },
  text: { flex: 1 },
});
