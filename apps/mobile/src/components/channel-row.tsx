import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ChannelReading } from '@/screens/event-view';
import { channelReadingAccessibleLabel, channelReadingLabel } from '@/screens/event-view';
import { useColors } from '@/theme/provider';
import { connectedListShape } from '@/theme/shape';
import { radius, withAlpha } from '@/theme/tokens';
import { type } from '@/theme/typography';
import { Icon } from './icon';
import { LiveDot } from './live-dot';

const IOS = Platform.OS === 'ios';

// The design's two shapes for the picker: separate glass cards on iOS, one connected
// Material list on Android. The play affordance follows its platform — a disc there, a
// squircle here.
const TARGET = IOS ? 44 : 52;

/**
 * A channel in the event's picker. The status line holds its slot in every state, the
 * withheld one included, so a channel coming on air is a data change and never a re-layout.
 *
 * An on-air row takes the `live` wash and its play affordance takes `primary`: the wash says
 * audio is moving, the teal disc says this is the thing to press. An offline row is a dashed
 * outline with a chevron, which is a destination rather than an action.
 */
export function ChannelRow({
  name,
  reading,
  index,
  count,
  onPress,
}: {
  name: string;
  reading: ChannelReading;
  index: number;
  count: number;
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
        IOS ? styles.iosRow : connectedListShape(index, count),
        onAir
          ? {
              backgroundColor: withAlpha(colors.live, IOS ? 0.14 : 0.16),
              borderColor: IOS ? withAlpha(colors.live, 0.38) : 'transparent',
            }
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
        <Text
          style={[
            type.note,
            styles.status,
            { color: onAir ? colors.liveOnMuted : colors.mutedForeground },
          ]}
        >
          {label ?? ''}
        </Text>
      </View>
      {onAir ? (
        <View
          style={[
            styles.target,
            IOS ? styles.targetDisc : styles.targetSquircle,
            { backgroundColor: colors.primary, shadowColor: colors.primary },
          ]}
        >
          <Icon name="listen" size={IOS ? 15 : 18} color={colors.primaryForeground} filled />
        </View>
      ) : (
        <View style={styles.target}>
          <Icon name="forward" size={IOS ? 18 : 20} color={colors.mutedForeground} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: IOS ? 14 : 16,
    paddingLeft: IOS ? 18 : 20,
    paddingRight: 15,
    paddingVertical: IOS ? 15 : 18,
    borderWidth: 1,
  },
  iosRow: { borderRadius: 22 },
  text: { flex: 1 },
  // The slot is held even when the label is empty: see the note above.
  status: { minHeight: 20 },
  target: {
    width: TARGET,
    height: TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Half the box rather than `radius.full`: Android drops a radius that far past the view's
  // own size on a small square, and the affordance renders as a hard square.
  targetDisc: {
    borderRadius: TARGET / 2,
    shadowOpacity: 0.32,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 10 },
  },
  targetSquircle: { borderRadius: radius.md + 2 },
});
