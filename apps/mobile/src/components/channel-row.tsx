import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ChannelReading } from '@/screens/event-view';
import { channelReadingAccessibleLabel, channelReadingLabel } from '@/screens/event-view';
import { useColors } from '@/theme/provider';
import { radius, spacing } from '@/theme/tokens';
import { type } from '@/theme/typography';
import { Icon } from './icon';
import { LiveDot } from './live-dot';

/**
 * The status line holds its slot in every state, the withheld one included, so a channel
 * coming on air is a data change and never a re-layout.
 */
export function ChannelRow({
  name,
  reading,
  onPress,
}: {
  name: string;
  reading: ChannelReading;
  onPress: () => void;
}) {
  const colors = useColors();
  const onAir = reading === 'on-air';
  const label = channelReadingLabel(reading);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name}
      accessibilityHint={channelReadingAccessibleLabel(reading)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        onAir
          ? { backgroundColor: colors.card, borderColor: colors.card }
          : { borderColor: colors.border, borderStyle: 'dashed' },
        { opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <LiveDot tone={onAir ? 'live' : 'offline'} />
      <View style={styles.text}>
        <Text
          numberOfLines={1}
          style={[type.subtitle, { color: onAir ? colors.foreground : colors.mutedForeground }]}
        >
          {name}
        </Text>
        <Text style={[type.note, styles.status, { color: colors.mutedForeground }]}>
          {label ?? ''}
        </Text>
      </View>
      {onAir ? (
        <View style={[styles.listen, { backgroundColor: colors.primary }]}>
          <Icon name="listen" size={15} color={colors.primaryForeground} filled />
        </View>
      ) : (
        <View style={styles.listen}>
          <Icon name="forward" size={18} color={colors.mutedForeground} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: spacing.panel,
    paddingVertical: 17,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  text: { flex: 1 },
  // The slot is held even when the label is empty: see the note above.
  status: { minHeight: 20 },
  listen: {
    width: spacing.action,
    height: spacing.action,
    // Half the box rather than `radius.full`: Android drops a radius that far past the
    // view's own size on a small square, and the affordance renders as a hard square.
    borderRadius: spacing.action / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
