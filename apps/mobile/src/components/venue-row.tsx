import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { radius, spacing, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import type { VenueRow as VenueRowData } from '@/venues/venue-list';

export type VenueRowProps = {
  row: VenueRowData;
  onOpen: (row: VenueRowData) => void;
  onTogglePinned: (row: VenueRowData) => void;
  onRemove: (row: VenueRowData) => void;
};

/** The host is identity rather than prose, and mono type is what says so on every row. */
const MONO_FAMILY = Platform.select({ ios: 'Menlo', default: 'monospace' });

export function VenueRow({ row, onOpen, onTogglePinned, onRemove }: VenueRowProps) {
  const theme = useTheme();
  const starSize = typography.subtitle.fontSize;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={row.name}
      accessibilityHint="Opens this event. Press and hold to remove it."
      onPress={() => onOpen(row)}
      onLongPress={() => onRemove(row)}
      style={({ pressed }) => [
        styles.row,
        pressed ? { backgroundColor: theme.colors.hoverOverlay } : null,
      ]}
    >
      <View style={styles.body}>
        <Text variant="section" numberOfLines={1}>
          {row.name}
        </Text>
        <Text
          variant="meta"
          color="mutedForeground"
          numberOfLines={1}
          style={{ fontFamily: MONO_FAMILY }}
        >
          {row.host}
        </Text>
        {row.lastConnectedLabel === null ? null : (
          <Text variant="note" color="mutedForeground" numberOfLines={1}>
            {row.lastConnectedLabel}
          </Text>
        )}
        {row.unavailableLabel === null ? null : (
          <Text variant="note" color="warnOnMuted" numberOfLines={1}>
            {row.unavailableLabel}
          </Text>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={row.pinned ? `Unpin ${row.name}` : `Pin ${row.name}`}
        onPress={() => onTogglePinned(row)}
        style={styles.star}
      >
        <Icon
          name={row.pinned ? 'star-filled' : 'star'}
          size={starSize}
          color={row.pinned ? 'primary' : 'mutedForeground'}
        />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.step * 3,
    paddingVertical: spacing.step * 4,
    paddingLeft: spacing.step * 5,
    paddingRight: spacing.step * 2,
    borderRadius: radius.lg,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: spacing.step / 2,
  },
  star: {
    width: spacing.touch,
    height: spacing.touch,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
});
