import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { HistoryEntry } from '@/history/history';
import {
  pinActionLabel,
  removeActionLabel,
  rowDetail,
  rowHost,
  rowSubtitle,
} from '@/screens/home-list';
import { useColors } from '@/theme/provider';
import { radius, spacing } from '@/theme/tokens';
import { MONO_FONT, type } from '@/theme/typography';
import { Icon } from './icon';

/**
 * The star is the pin control, reachable by tap. A long press works too, but a gesture is
 * not an affordance — and neither a long press nor a swipe is reachable under VoiceOver or
 * TalkBack, which is why Remove is also an accessibility action on the row.
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
        { backgroundColor: colors.card, opacity: pressed ? 0.92 : 1 },
      ]}
    >
      <View style={styles.text}>
        <Text
          numberOfLines={1}
          style={[type.subtitle, { color: muted ? colors.mutedForeground : colors.foreground }]}
        >
          {entry.name}
        </Text>
        <Text numberOfLines={1} style={[styles.host, { color: colors.mutedForeground }]}>
          {rowHost(entry)}
        </Text>
        <Text numberOfLines={1} style={[type.meta, { color: colors.mutedForeground }]}>
          {rowDetail(entry)}
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={pinActionLabel(entry)}
        accessibilityState={{ selected: entry.pinned }}
        onPress={onTogglePin}
        hitSlop={10}
        style={styles.star}
      >
        <Icon
          name="pin"
          size={19}
          filled={entry.pinned}
          strokeWidth={entry.pinned ? 1.6 : 1.8}
          color={entry.pinned ? colors.primary : colors.mutedForeground}
        />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    minHeight: spacing.touch + 20,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  text: { flex: 1, gap: 3 },
  host: { fontFamily: MONO_FONT, fontSize: 12, lineHeight: 16 },
  star: {
    width: spacing.touch,
    height: spacing.touch,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  unavailable: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
