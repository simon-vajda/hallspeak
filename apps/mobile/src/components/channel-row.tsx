import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/text';
import { radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import type { ChannelRowView } from '@/venues/event-view';

export type ChannelRowProps = {
  row: ChannelRowView;
  onOpen: (row: ChannelRowView) => void;
};

const DOT_SIZE = spacing.step * 2.5;
const DOT_RING = 1.5;

/**
 * Every slot is drawn in both states — the dot, the status line and the trailing target all
 * keep their box — so a channel that is on air and one that is not differ in colour alone and
 * nothing below them moves.
 */
export function ChannelRow({ row, onOpen }: ChannelRowProps) {
  const theme = useTheme();
  const markSize = typography.body.fontSize;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${row.name}, ${row.statusLabel}`}
      onPress={() => onOpen(row)}
      style={({ pressed }) => [
        styles.row,
        row.online
          ? { backgroundColor: theme.colors.liveMuted, borderColor: theme.colors.liveMuted }
          : { borderColor: theme.colors.border, borderStyle: 'dashed' },
        pressed ? { backgroundColor: theme.colors.hoverOverlay } : null,
      ]}
    >
      <View
        style={[
          styles.dot,
          row.online
            ? { backgroundColor: theme.colors.live }
            : { borderWidth: DOT_RING, borderColor: theme.colors.border },
        ]}
      />

      <View style={styles.body}>
        <Text variant="subtitle" color={row.online ? 'foreground' : 'mutedForeground'}>
          {row.name}
        </Text>
        <Text variant="note" color={row.online ? 'liveOnMuted' : 'mutedForeground'}>
          {row.statusLabel}
        </Text>
      </View>

      <View style={[styles.target, row.online ? { backgroundColor: theme.colors.primary } : null]}>
        <Text
          variant="body"
          color={row.online ? 'primaryForeground' : 'mutedForeground'}
          style={{ fontSize: markSize, lineHeight: markSize * 1.3 }}
        >
          {row.online ? '▶' : '›'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.step * 3.5,
    paddingVertical: spacing.step * 3.75,
    paddingLeft: spacing.step * 4.5,
    paddingRight: spacing.step * 3.75,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: radius.full,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: spacing.step / 2,
  },
  target: {
    width: spacing.touch,
    height: spacing.touch,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
