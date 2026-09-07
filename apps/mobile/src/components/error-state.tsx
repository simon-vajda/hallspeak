import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { useColors } from '@/theme/provider';
import { spacing } from '@/theme/tokens';
import { type } from '@/theme/typography';
import { Icon } from './icon';
import type { IconName } from './icons';

/**
 * The one failure surface both public screens show. It scrolls so the pull-to-refresh that
 * recovers from it is available on the failure itself, not only once something rendered.
 * A failure a retry cannot change omits `onRefresh` and gets no pull affordance.
 */
export function ErrorState({
  title,
  body,
  icon = 'unreachable',
  refreshing = false,
  onRefresh,
  children,
}: {
  title: string;
  body: string;
  icon?: IconName;
  refreshing?: boolean;
  onRefresh?: () => void;
  children?: ReactNode;
}) {
  const colors = useColors();

  return (
    <ScrollView
      contentContainerStyle={styles.centre}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined
      }
    >
      <Icon name={icon} size={28} color={colors.mutedForeground} />
      <Text style={[type.title, styles.centred, { color: colors.foreground }]}>{title}</Text>
      <Text style={[type.note, styles.centred, { color: colors.mutedForeground }]}>{body}</Text>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centre: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: spacing.overlay,
  },
  centred: { textAlign: 'center' },
});
