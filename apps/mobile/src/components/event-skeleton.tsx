import { Platform, StyleSheet, Text, View } from 'react-native';
import { CHOOSE_A_CHANNEL, LOADING_EVENT } from '@/screens/event-view';
import { useColors, useSurfaces } from '@/theme/provider';
import { connectedListShape } from '@/theme/shape';
import { radius } from '@/theme/tokens';
import { type } from '@/theme/typography';
import { channelRowStyles } from './channel-row';
import { Placeholder, PlaceholderLine } from './placeholder';

const IOS = Platform.OS === 'ios';
const ROWS = 3;
const CHIP_PADDING_Y = 7;

/**
 * The Event screen's layout, shared by the loaded view and its skeleton so the two cannot
 * drift apart and an arriving event replaces the skeleton in place.
 */
export const eventLayout = StyleSheet.create({
  content: { paddingHorizontal: IOS ? 20 : 24, paddingTop: IOS ? 18 : 12, paddingBottom: 44 },
  header: { gap: 12 },
  hostChip: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 15,
    paddingVertical: CHIP_PADDING_Y,
    borderRadius: radius.full,
  },
  section: { gap: 12, paddingTop: IOS ? 24 : 26 },
  // The picker runs wider than the prose above it, as the design draws it.
  list: { gap: IOS ? 10 : 3, marginHorizontal: IOS ? -4 : -8 },
});

/**
 * The shape of an event before it has been read: its name, one line of description, the host
 * chip and three channel rows, each at the size of what replaces it. The section label is the
 * real text, because it does not depend on the answer.
 */
export function EventSkeleton() {
  const colors = useColors();
  const surfaces = useSurfaces();

  return (
    <View accessible accessibilityLabel={LOADING_EVENT} accessibilityState={{ busy: true }}>
      <View style={eventLayout.header}>
        <PlaceholderLine step="screen" width="72%" />
        <PlaceholderLine step="bodyLg" width="88%" />
        <View style={styles.chip}>
          <Placeholder width={148} height={type.meta.lineHeight + CHIP_PADDING_Y * 2} />
        </View>
      </View>

      <View style={eventLayout.section}>
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={[type.label, { color: colors.mutedForeground }]}
        >
          {CHOOSE_A_CHANNEL.toUpperCase()}
        </Text>
        <View style={eventLayout.list}>
          {Array.from({ length: ROWS }, (_, index) => (
            <View
              // biome-ignore lint/suspicious/noArrayIndexKey: a fixed count of identical blanks
              key={index}
              style={[
                channelRowStyles.row,
                IOS ? channelRowStyles.iosRow : connectedListShape(index, ROWS),
                IOS
                  ? { borderColor: colors.border }
                  : { backgroundColor: surfaces.base, borderWidth: 0 },
              ]}
            >
              <Placeholder width={10} height={10} />
              <View style={channelRowStyles.text}>
                <PlaceholderLine step="subtitle" width={`${60 - index * 12}%`} />
                <Text style={[type.note, channelRowStyles.status, styles.holder]}> </Text>
              </View>
              <View style={channelRowStyles.target} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { alignSelf: 'flex-start', marginTop: 4 },
  holder: { color: 'transparent' },
});
