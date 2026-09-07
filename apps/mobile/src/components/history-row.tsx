import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { HistoryEntry } from '@/history/history';
import { pinActionLabel, removeActionLabel, rowSubtitle } from '@/screens/home-list';
import { useColors } from '@/theme/provider';
import { radius, spacing } from '@/theme/tokens';
import { type } from '@/theme/typography';
import { Icon } from './icon';

/**
 * Pin and Remove are accessibility actions as well as gestures. Neither a swipe nor a long
 * press is reachable under VoiceOver or TalkBack, so without these the two actions would be
 * unavailable to a screen-reader user rather than merely awkward. The visual row is unchanged.
 */
export function HistoryRow({
  entry,
  onOpen,
  onTogglePin,
  onRemove,
}: {
  entry: HistoryEntry;
  onOpen: () => void;
  onTogglePin: () => void;
  onRemove: () => void;
}) {
  const colors = useColors();
  const muted = entry.unavailable;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={entry.name}
      accessibilityHint={rowSubtitle(entry)}
      accessibilityActions={[
        { name: 'pin', label: pinActionLabel(entry) },
        { name: 'remove', label: removeActionLabel(entry) },
      ]}
      onAccessibilityAction={({ nativeEvent }) => {
        if (nativeEvent.actionName === 'pin') {
          onTogglePin();
        } else if (nativeEvent.actionName === 'remove') {
          onRemove();
        }
      }}
      onPress={onOpen}
      onLongPress={onTogglePin}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={styles.text}>
        <Text
          numberOfLines={1}
          style={[type.subtitle, { color: muted ? colors.mutedForeground : colors.foreground }]}
        >
          {entry.name}
        </Text>
        <Text numberOfLines={1} style={[type.meta, { color: colors.mutedForeground }]}>
          {rowSubtitle(entry)}
        </Text>
        {muted ? (
          <View style={styles.unavailable}>
            <Icon name="unreachable" size={13} color={colors.warnOnMuted} />
            <Text style={[type.meta, { color: colors.warnOnMuted }]}>
              Could not be reached last time
            </Text>
          </View>
        ) : null}
      </View>
      {entry.pinned ? <Icon name="pin" size={16} color={colors.mutedForeground} /> : null}
      <Icon name="forward" size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: spacing.touch + 20,
    paddingHorizontal: spacing.panel,
    paddingVertical: 14,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: { flex: 1, gap: 3 },
  unavailable: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
