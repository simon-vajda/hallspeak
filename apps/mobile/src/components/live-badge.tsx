import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/theme/provider';
import { radius } from '@/theme/tokens';
import { type } from '@/theme/typography';
import { LiveDot } from './live-dot';

/**
 * `label` is a prop rather than derived: each screen's state ladder is its own.
 * `showDot={false}` is the same chip carrying a name rather than a state — the dot means an
 * interpreter is connected, so a chip that is not reporting liveness must not show one.
 */
export function LiveBadge({
  live,
  label,
  showDot = true,
}: {
  live: boolean;
  label: string;
  showDot?: boolean;
}) {
  const colors = useColors();

  return (
    <View style={[styles.badge, { backgroundColor: live ? colors.liveMuted : colors.secondary }]}>
      {showDot ? <LiveDot size="sm" tone={live ? 'live' : 'offline'} /> : null}
      <Text
        style={[
          type.label,
          styles.label,
          { color: live ? colors.liveOnMuted : colors.mutedForeground },
        ]}
      >
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  label: { includeFontPadding: false },
});
