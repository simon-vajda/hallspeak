import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ChannelReading } from '@/screens/event-view';
import { channelReadingAccessibleLabel, channelReadingLabel } from '@/screens/event-view';
import { useColors, useSurfaces } from '@/theme/provider';
import { connectedListShape } from '@/theme/shape';
import { radius, withAlpha } from '@/theme/tokens';
import { type } from '@/theme/typography';
import { Icon } from './icon';
import { LiveDot } from './live-dot';
import { pressOpacity, ripple } from './press';

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
 * audio is moving, the teal disc says this is the thing to press. An offline row keeps the
 * neutral outline and a chevron, which is a destination rather than an action.
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
  const surfaces = useSurfaces();
  const onAir = reading === 'on-air';
  const label = channelReadingLabel(reading);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name}
      accessibilityHint={channelReadingAccessibleLabel(reading)}
      onPress={onPress}
      android_ripple={ripple(withAlpha(onAir ? colors.live : colors.foreground, 0.14))}
      style={({ pressed }) => [
        styles.row,
        IOS ? styles.iosRow : connectedListShape(index, count),
        onAir
          ? {
              // Opaque on Android, because that platform draws an elevated view's shadow
              // through a translucent fill and the wash comes out muddy under the teal disc.
              backgroundColor: IOS ? withAlpha(colors.live, 0.14) : colors.liveMuted,
              borderColor: IOS ? withAlpha(colors.live, 0.38) : 'transparent',
            }
          : {
              // Android fills the offline row from the tonal ladder so the connected list reads
              // as one object; iOS keeps it an outline, which is what a separate card is.
              backgroundColor: IOS ? undefined : surfaces.base,
              borderColor: colors.border,
              borderWidth: IOS ? 1 : 0,
            },
        // The one elevated surface in the Android app, and the rule is that narrow: a shadow
        // means audio is moving. Every other container is flat and separated by tone, which is
        // what keeps this one reading as raised rather than as decoration.
        IOS || !onAir ? null : styles.elevated,
        { opacity: pressOpacity(pressed) },
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
    // Keeps the ripple inside the row's own connected-list corners.
    overflow: 'hidden',
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
  elevated: { elevation: 2 },
});
